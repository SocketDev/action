import { readFile } from 'node:fs/promises'

import { isPlainObject } from '@socketsecurity/lib-stable/objects/predicates'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { gfm } from 'micromark-extension-gfm'
import { parseAst } from 'rolldown/parseAst'
import { isMap, isScalar, parseDocument } from 'yaml'

import { REPO_ROOT } from '../paths.mts'
import { isMainModule } from '../../fleet/process/is-main-module.mts'
import { runMain } from '../../fleet/process/main/run.mts'

import type { ScriptMeta } from '../../fleet/process/main/run.mts'

export const SCRIPT_META: ScriptMeta = {
  describe: 'Check manifest coverage in the Action reference.',
  help: 'Usage: pnpm run docs:action:check',
}

interface ManifestEntry {
  name: string
  required: boolean
  defaultValue: string | undefined
}

interface CoverageProblem {
  message: string
}

function parseManifestEntries(
  manifest: string,
  section: string,
): ManifestEntry[] {
  const document = parseDocument(manifest, { uniqueKeys: true })
  if (document.errors.length > 0 || !isMap(document.contents)) {
    throw new Error(`action.yml: invalid YAML manifest`)
  }
  const sectionNode = document.contents.get(section, true)
  if (!isMap(sectionNode)) {
    throw new Error(`action.yml: ${section} must be a mapping`)
  }

  return sectionNode.items.map(({ key, value }) => {
    if (!isScalar(key) || typeof key.value !== 'string' || !isMap(value)) {
      throw new Error(`action.yml: ${section} entries must be named mappings`)
    }
    const requiredNode = value.get('required', true)
    const defaultNode = value.get('default', true)
    if (
      (requiredNode !== undefined &&
        (!isScalar(requiredNode) || typeof requiredNode.value !== 'boolean')) ||
      (defaultNode !== undefined &&
        (!isScalar(defaultNode) || typeof defaultNode.value !== 'string'))
    ) {
      throw new Error(`action.yml: invalid required/default for ${key.value}`)
    }
    return {
      __proto__: null,
      name: key.value,
      required: isScalar(requiredNode) && requiredNode.value === true,
      defaultValue:
        isScalar(defaultNode) && typeof defaultNode.value === 'string'
          ? defaultNode.value
          : undefined,
    }
  })
}

function cellText(cell: {
  children: Array<{ type: string; value?: string | undefined }>
}): string {
  return cell.children
    .map(child => (child.value === undefined ? '' : child.value))
    .join('')
    .trim()
}

function parseTableRows(
  markdown: string,
  heading: string,
): Array<{ identifier: string | undefined; cells: string[] }> {
  const tree = fromMarkdown(markdown, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  })
  const headingNode = tree.children.find(
    node =>
      node.type === 'heading' &&
      node.depth === 2 &&
      cellText({ children: node.children }) === heading,
  )
  if (headingNode === undefined) {
    throw new Error(`docs/action.md: missing ## ${heading} section`)
  }
  const headingIndex = tree.children.indexOf(headingNode)
  const tableNode = tree.children
    .slice(headingIndex + 1)
    .find(node => node.type === 'heading' || node.type === 'table')
  if (tableNode?.type !== 'table') {
    throw new Error(`docs/action.md: missing ${heading} table`)
  }
  return tableNode.children.slice(1).map(row => {
    const firstCell = row.children[0]
    const identifierNode = firstCell?.children[0]
    const identifier =
      firstCell?.children.length === 1 &&
      identifierNode?.type === 'inlineCode' &&
      'value' in identifierNode &&
      typeof identifierNode.value === 'string'
        ? identifierNode.value
        : undefined
    return {
      __proto__: null,
      identifier,
      cells: row.children.map(cell => cellText(cell)),
    }
  })
}

function documentedEntries(
  markdown: string,
  heading: string,
): { rows: Map<string, string[]>; problems: CoverageProblem[] } {
  const rows = new Map<string, string[]>()
  const problems: CoverageProblem[] = []
  for (const [index, row] of parseTableRows(markdown, heading).entries()) {
    const name = row.identifier
    if (name === undefined || name.length === 0) {
      problems.push({
        message: `${heading} row ${index + 1} has no identifier`,
      })
      continue
    }
    if (rows.has(name)) {
      problems.push({ message: `${heading} duplicates ${name}` })
      continue
    }
    rows.set(name, row.cells)
  }
  return { rows, problems }
}

function isIdentifier(value: unknown, name: string): boolean {
  return (
    isPlainObject(value) && value.type === 'Identifier' && value.name === name
  )
}

function isModeDiscriminant(value: unknown): boolean {
  return (
    isPlainObject(value) &&
    value.type === 'MemberExpression' &&
    value.computed === false &&
    value.optional === false &&
    isIdentifier(value.object, 'inputs') &&
    isIdentifier(value.property, 'mode')
  )
}

function visitAst(
  value: unknown,
  visit: (node: Record<string, unknown>) => void,
): void {
  if (Array.isArray(value)) {
    for (const child of value) {
      visitAst(child, visit)
    }
    return
  }
  if (!isPlainObject(value) || typeof value.type !== 'string') {
    return
  }
  visit(value)
  const children = Object.values(value)
  for (let index = 0; index < children.length; index += 1) {
    visitAst(children[index], visit)
  }
}

function extractModes(source: string): string[] {
  let ast: unknown
  try {
    ast = parseAst(source, { lang: 'js' }, 'src/main.js')
  } catch {
    throw new Error('src/main.js: unable to parse action entrypoint')
  }
  const modeSwitches: Array<Record<string, unknown>> = []
  visitAst(ast, node => {
    if (
      node.type === 'SwitchStatement' &&
      isModeDiscriminant(node.discriminant)
    ) {
      modeSwitches.push(node)
    }
  })
  if (modeSwitches.length !== 1) {
    throw new Error('src/main.js: expected one switch over inputs.mode')
  }
  const modeSwitch = modeSwitches[0]
  if (!isPlainObject(modeSwitch) || !Array.isArray(modeSwitch.cases)) {
    throw new Error('src/main.js: missing mode switch')
  }
  const modes: string[] = []
  let defaultCount = 0
  for (const clause of modeSwitch.cases) {
    if (!isPlainObject(clause) || clause['type'] !== 'SwitchCase') {
      throw new Error('src/main.js: unsupported inputs.mode dispatch case')
    }
    if (clause['test'] === null) {
      defaultCount += 1
    } else if (
      isPlainObject(clause['test']) &&
      clause['test']['type'] === 'Literal' &&
      typeof clause['test']['value'] === 'string'
    ) {
      modes.push(clause['test']['value'])
    } else {
      throw new Error('src/main.js: unsupported inputs.mode dispatch case')
    }
  }
  if (
    defaultCount !== 1 ||
    modes.length === 0 ||
    new Set(modes).size !== modes.length
  ) {
    throw new Error('src/main.js: unsupported inputs.mode dispatch shape')
  }
  return modes
}

function compareIdentifiers(
  manifestEntries: ManifestEntry[],
  documentedRows: Map<string, string[]>,
  section: string,
  problems: CoverageProblem[],
): void {
  const manifestNames = new Set(manifestEntries.map(entry => entry.name))
  for (const name of manifestNames) {
    if (!documentedRows.has(name)) {
      problems.push({ message: `${section} is missing ${name}` })
    }
  }
  for (const name of documentedRows.keys()) {
    if (!manifestNames.has(name)) {
      problems.push({ message: `${section} has stale identifier ${name}` })
    }
  }
}

function checkInputRows(
  inputs: ManifestEntry[],
  documentedRows: Map<string, string[]>,
  problems: CoverageProblem[],
): void {
  for (let index = 0, { length } = inputs; index < length; index += 1) {
    const input = inputs[index]
    if (input === undefined) {
      continue
    }
    const row = documentedRows.get(input.name)
    if (row === undefined) {
      continue
    }
    const required = row[1]
    const expectedRequired = input.required ? 'Yes' : 'No'
    if (required !== expectedRequired) {
      problems.push({
        message:
          `Inputs ${input.name} required is ${required ?? '(missing)'}; ` +
          `expected ${expectedRequired}`,
      })
    }
    const documentedDefault = row[2]
    const expectedDefault = input.defaultValue ?? 'Not set'
    const normalizedDefault =
      documentedDefault === "''" ? '' : documentedDefault
    if (normalizedDefault !== expectedDefault) {
      problems.push({
        message:
          `Inputs ${input.name} default is ` +
          `${documentedDefault ?? '(missing)'}; ` +
          `expected ${expectedDefault}`,
      })
    }
  }
}

function checkModeRows(
  documentedRows: Map<string, string[]>,
  source: string,
  problems: CoverageProblem[],
): void {
  const supportedModes = extractModes(source)
  const modeNames = new Set(supportedModes)
  if (!modeNames.has('cli') && !documentedRows.has('cli')) {
    problems.push({ message: 'Modes is missing unsupported mode cli' })
  }
  for (const mode of modeNames) {
    const row = documentedRows.get(mode)
    if (row === undefined) {
      problems.push({ message: `Modes is missing ${mode}` })
    } else if (row[1] !== 'Yes') {
      problems.push({
        message:
          `Modes ${mode} supported is ${row[1] ?? '(missing)'}; ` +
          'expected Yes',
      })
    }
  }
  for (const mode of documentedRows.keys()) {
    if (modeNames.has(mode)) {
      continue
    }
    const row = documentedRows.get(mode)
    if (row?.[1] !== 'No') {
      problems.push({
        message:
          `Modes ${mode} supported is ${row?.[1] ?? '(missing)'}; ` +
          'expected No',
      })
    }
    if (mode !== 'cli') {
      problems.push({ message: `Modes has stale identifier ${mode}` })
    }
  }
}

export function checkActionDocumentation(
  manifest: string,
  markdown: string,
  source: string,
): string[] {
  const problems: CoverageProblem[] = []
  const inputs = parseManifestEntries(manifest, 'inputs')
  const outputs = parseManifestEntries(manifest, 'outputs')
  const inputDocs = documentedEntries(markdown, 'Inputs')
  const outputDocs = documentedEntries(markdown, 'Outputs')
  const modeDocs = documentedEntries(markdown, 'Modes')
  problems.push(
    ...inputDocs.problems,
    ...outputDocs.problems,
    ...modeDocs.problems,
  )
  compareIdentifiers(inputs, inputDocs.rows, 'Inputs', problems)
  compareIdentifiers(outputs, outputDocs.rows, 'Outputs', problems)
  checkInputRows(inputs, inputDocs.rows, problems)
  checkModeRows(modeDocs.rows, source, problems)
  return problems.map(problem => problem.message)
}

export async function main(): Promise<void> {
  const files = await Promise.all([
    readFile(`${REPO_ROOT}/action.yml`, 'utf8'),
    readFile(`${REPO_ROOT}/docs/action.md`, 'utf8'),
    readFile(`${REPO_ROOT}/src/main.js`, 'utf8'),
  ])
  const { 0: manifest, 1: markdown, 2: source } = files
  const problems = checkActionDocumentation(manifest, markdown, source)
  if (problems.length > 0) {
    throw new Error(
      `Action documentation coverage failed:\n${problems.join('\n')}`,
    )
  }
}

if (isMainModule(import.meta.url)) {
  runMain(main, SCRIPT_META)
}
