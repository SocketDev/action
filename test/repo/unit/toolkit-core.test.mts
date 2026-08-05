// The first-party @actions/core slice (src/toolkit/core.js) — inputs via
// INPUT_* env vars, file commands via temp GITHUB_OUTPUT/GITHUB_ENV/
// GITHUB_PATH files, workflow-command escaping on captured stdout, and the
// buffered job summary against a temp GITHUB_STEP_SUMMARY file.

import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import {
  Summary,
  addPath,
  core,
  debug,
  exportVariable,
  getBooleanInput,
  getInput,
  isDebug,
  setFailed,
  setOutput,
  setSecret,
  warning,
} from '../../../src/toolkit/core.js'

const HEREDOC_PATTERN =
  /^(?<key>[^<]+)<<(?<delim>ghadelimiter_[0-9a-f-]{36})\r?\n(?<value>[\s\S]*)\r?\n\2\r?\n$/

let envSnapshot: NodeJS.ProcessEnv
let exitCodeSnapshot: number | string | undefined
let stdout: string[]
let stdoutSpy: ReturnType<typeof vi.spyOn>
let tmpDir: string

function tmpCommandFile(name: string): string {
  const filePath = path.join(tmpDir, name)
  writeFileSync(filePath, '')
  return filePath
}

beforeEach(() => {
  envSnapshot = { ...process.env }
  exitCodeSnapshot = process.exitCode
  delete process.env['GITHUB_ENV']
  delete process.env['GITHUB_OUTPUT']
  delete process.env['GITHUB_PATH']
  delete process.env['GITHUB_STEP_SUMMARY']
  tmpDir = mkdtempSync(path.join(os.tmpdir(), 'toolkit-core-'))
  stdout = []
  stdoutSpy = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation((chunk: unknown) => {
      stdout.push(String(chunk))
      return true
    })
})

afterEach(() => {
  stdoutSpy.mockRestore()
  process.exitCode = exitCodeSnapshot
  for (const key of Object.keys(process.env)) {
    if (!(key in envSnapshot)) {
      delete process.env[key]
    }
  }
  Object.assign(process.env, envSnapshot)
  rmSync(tmpDir, { force: true, recursive: true })
})

describe('getInput', () => {
  test('reads INPUT_<NAME> with spaces upper-snaked and trims by default', () => {
    process.env['INPUT_MY_FANCY_INPUT'] = '  padded value  '
    assert.equal(getInput('my fancy input'), 'padded value')
  })

  test('keeps whitespace when trimWhitespace is false', () => {
    process.env['INPUT_RAW'] = '  keep me  '
    assert.equal(getInput('raw', { trimWhitespace: false }), '  keep me  ')
  })

  test('returns an empty string for an undefined input', () => {
    assert.equal(getInput('absent'), '')
  })

  test('throws the upstream message for a missing required input', () => {
    expect(() => getInput('needed', { required: true })).toThrow(
      'Input required and not supplied: needed',
    )
  })
})

describe('getBooleanInput', () => {
  test.each(['true', 'True', 'TRUE'])('accepts %s as true', val => {
    process.env['INPUT_FLAG'] = val
    assert.equal(getBooleanInput('flag'), true)
  })

  test.each(['false', 'False', 'FALSE'])('accepts %s as false', val => {
    process.env['INPUT_FLAG'] = val
    assert.equal(getBooleanInput('flag'), false)
  })

  test('rejects anything outside the YAML 1.2 core-schema sets', () => {
    process.env['INPUT_FLAG'] = 'yes'
    expect(() => getBooleanInput('flag')).toThrow(
      'Input does not meet YAML 1.2 "Core Schema" specification: flag',
    )
  })
})

describe('setOutput', () => {
  test('appends a heredoc-framed record to GITHUB_OUTPUT', () => {
    const outFile = tmpCommandFile('output')
    process.env['GITHUB_OUTPUT'] = outFile
    setOutput('result', 'multi\nline')
    const match = readFileSync(outFile, 'utf8').match(HEREDOC_PATTERN)
    assert.ok(match?.groups)
    assert.equal(match.groups['key'], 'result')
    assert.equal(match.groups['value'], 'multi\nline')
  })

  test('JSON.stringify-s a non-string value', () => {
    const outFile = tmpCommandFile('output')
    process.env['GITHUB_OUTPUT'] = outFile
    setOutput('data', { ok: true })
    const match = readFileSync(outFile, 'utf8').match(HEREDOC_PATTERN)
    assert.equal(match?.groups?.['value'], '{"ok":true}')
  })

  test('falls back to the legacy ::set-output command without GITHUB_OUTPUT', () => {
    setOutput('name with %', 'v%\r\n1')
    assert.deepEqual(stdout, [
      os.EOL,
      `::set-output name=name with %25::v%25%0D%0A1${os.EOL}`,
    ])
  })

  test('throws when GITHUB_OUTPUT points at a missing file', () => {
    const missing = path.join(tmpDir, 'nope')
    process.env['GITHUB_OUTPUT'] = missing
    expect(() => setOutput('k', 'v')).toThrow(
      `Missing file at path: ${missing}`,
    )
  })
})

describe('exportVariable', () => {
  test('sets process.env and appends a heredoc record to GITHUB_ENV', () => {
    const envFile = tmpCommandFile('env')
    process.env['GITHUB_ENV'] = envFile
    exportVariable('MY_EXPORTED_VAR', 'exported value')
    assert.equal(process.env['MY_EXPORTED_VAR'], 'exported value')
    const match = readFileSync(envFile, 'utf8').match(HEREDOC_PATTERN)
    assert.equal(match?.groups?.['key'], 'MY_EXPORTED_VAR')
    assert.equal(match?.groups?.['value'], 'exported value')
  })
})

describe('addPath', () => {
  test('appends to GITHUB_PATH and prepends to process.env.PATH', () => {
    const pathFile = tmpCommandFile('path')
    process.env['GITHUB_PATH'] = pathFile
    const priorPath = process.env['PATH']
    const dir = path.join(tmpDir, 'bin')
    addPath(dir)
    assert.equal(readFileSync(pathFile, 'utf8'), `${dir}${os.EOL}`)
    assert.equal(process.env['PATH'], `${dir}${path.delimiter}${priorPath}`)
  })
})

describe('workflow commands', () => {
  test('setSecret issues ::add-mask::', () => {
    setSecret('hunter2')
    assert.deepEqual(stdout, [`::add-mask::hunter2${os.EOL}`])
  })

  test('debug escapes %, CR, and LF in the message', () => {
    debug('50% done\r\nnext')
    assert.deepEqual(stdout, [`::debug::50%25 done%0D%0Anext${os.EOL}`])
  })

  test('warning additionally escapes : and , in properties', () => {
    warning('careful', { title: 'a:b,c%d' })
    assert.deepEqual(stdout, [
      `::warning title=a%3Ab%2Cc%25d::careful${os.EOL}`,
    ])
  })

  test('setFailed issues ::error:: and sets exitCode 1 without exiting', () => {
    setFailed('it broke')
    assert.deepEqual(stdout, [`::error::it broke${os.EOL}`])
    assert.equal(process.exitCode, 1)
  })

  test('core.info writes the message plus EOL through the default export', () => {
    core.info('hello')
    assert.deepEqual(stdout, [`hello${os.EOL}`])
  })

  test('isDebug reflects RUNNER_DEBUG=1 exactly', () => {
    delete process.env['RUNNER_DEBUG']
    assert.equal(isDebug(), false)
    process.env['RUNNER_DEBUG'] = '1'
    assert.equal(isDebug(), true)
    process.env['RUNNER_DEBUG'] = '0'
    assert.equal(isDebug(), false)
  })
})

describe('summary', () => {
  test('addRaw buffers text with an optional EOL and write appends then clears', async () => {
    const summaryFile = tmpCommandFile('summary')
    process.env['GITHUB_STEP_SUMMARY'] = summaryFile
    const summary = new Summary()
    summary.addRaw('<h2>Report</h2>', true).addRaw('tail')
    assert.equal(summary.stringify(), `<h2>Report</h2>${os.EOL}tail`)
    await summary.write()
    assert.equal(summary.stringify(), '')
    summary.addRaw(' more')
    await summary.write()
    assert.equal(
      readFileSync(summaryFile, 'utf8'),
      `<h2>Report</h2>${os.EOL}tail more`,
    )
  })

  test('addTable renders th/td cells with colspan and rowspan attributes', () => {
    const summary = new Summary()
    summary.addTable([
      [
        { data: 'Name', header: true },
        { data: 'Status', header: true },
      ],
      ['left', { data: 'wide', colspan: '2' }],
      [{ data: 'tall', rowspan: '3' }],
    ])
    assert.equal(
      summary.stringify(),
      '<table>' +
        '<tr><th>Name</th><th>Status</th></tr>' +
        '<tr><td>left</td><td colspan="2">wide</td></tr>' +
        '<tr><td rowspan="3">tall</td></tr>' +
        `</table>${os.EOL}`,
    )
  })

  test('write with overwrite replaces the file contents', async () => {
    const summaryFile = tmpCommandFile('summary')
    writeFileSync(summaryFile, 'stale')
    process.env['GITHUB_STEP_SUMMARY'] = summaryFile
    const summary = new Summary()
    await summary.addRaw('fresh').write({ overwrite: true })
    assert.equal(readFileSync(summaryFile, 'utf8'), 'fresh')
  })

  test('write rejects with the upstream message when the env var is absent', async () => {
    const summary = new Summary()
    await expect(summary.addRaw('x').write()).rejects.toThrow(
      'Unable to find environment variable for $GITHUB_STEP_SUMMARY',
    )
  })
})
