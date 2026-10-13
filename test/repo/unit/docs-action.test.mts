import { describe, expect, it } from 'vitest'

import { checkActionDocumentation } from '../../../scripts/repo/check/docs-action.mts'

const manifest = `
inputs:
  mode:
    description: Mode
    required: true
  empty:
    description: Empty default
    default: ''
outputs:
  path:
    description: Result path
`

const source = `
export async function main() {
  switch (inputs.mode) {
    case 'firewall': {
      break
    }
    default: {
      throw new Error('unsupported')
    }
  }
}
`

const documentation = `
## Modes

| Mode | Supported | Behavior |
| --- | --- | --- |
| \`firewall\` | Yes | Runs Firewall. |
| \`cli\` | No | Declared but unsupported. |

## Inputs

| Input | Required | Default | Effect |
| --- | --- | --- | --- |
| \`mode\` | Yes | Not set | Selects the mode. |
| \`empty\` | No | \`''\` | Has an empty default. |

## Outputs

| Output | Set in | Value |
| --- | --- | --- |
| \`path\` | Always | Result path. |
`

describe('Action manifest documentation coverage', () => {
  it('accepts identifiers, required flags, defaults, and modes', () => {
    expect(checkActionDocumentation(manifest, documentation, source)).toEqual(
      [],
    )
  })

  it('does not count a prose mention as table coverage', () => {
    const proseMention = documentation
      .replace('| `mode` | Yes | Not set | Selects the mode. |\n', '')
      .replace(
        '## Inputs',
        'The `mode` input selects the action behavior.\n\n## Inputs',
      )
    expect(checkActionDocumentation(manifest, proseMention, source)).toContain(
      'Inputs is missing mode',
    )
  })

  it('reports a newly declared input by exact identifier', () => {
    const changedManifest = manifest.replace(
      'outputs:',
      '  new-input:\n    description: New input\noutputs:',
    )
    expect(
      checkActionDocumentation(changedManifest, documentation, source),
    ).toContain('Inputs is missing new-input')
  })

  it('reports a newly declared output by exact identifier', () => {
    const changedManifest = manifest.replace(
      'outputs:\n',
      'outputs:\n  new-output:\n    description: New output\n',
    )
    expect(
      checkActionDocumentation(changedManifest, documentation, source),
    ).toContain('Outputs is missing new-output')
  })

  it('reports a changed literal default', () => {
    const changedManifest = manifest.replace("default: ''", 'default: latest')
    expect(
      checkActionDocumentation(changedManifest, documentation, source),
    ).toContain("Inputs empty default is ''; expected latest")
  })

  it('reports duplicate table identifiers', () => {
    const duplicatedDocs = documentation.replace(
      "| `empty` | No | `''` | Has an empty default. |",
      [
        '| `mode` | Yes | Not set | Duplicate mode. |',
        "| `empty` | No | `''` | Has an empty default. |",
      ].join('\n'),
    )
    expect(
      checkActionDocumentation(manifest, duplicatedDocs, source),
    ).toContain('Inputs duplicates mode')
  })

  it('rejects unsupported mode dispatch shapes', () => {
    const changedSource = source.replace("case 'firewall':", 'case modeName:')
    expect(() =>
      checkActionDocumentation(manifest, documentation, changedSource),
    ).toThrow('src/main.js: unsupported inputs.mode dispatch case')
  })

  it('rejects syntax errors before extracting dispatch cases', () => {
    const invalidSource = source.replace(
      'switch (inputs.mode)',
      'switch (inputs.mode',
    )
    expect(() =>
      checkActionDocumentation(manifest, documentation, invalidSource),
    ).toThrow('src/main.js: unable to parse action entrypoint')
  })

  it('rejects malformed manifest entry mappings', () => {
    const malformedManifest = manifest.replace(
      "  empty:\n    description: Empty default\n    default: ''\n",
      '  empty: text\n',
    )
    expect(() =>
      checkActionDocumentation(malformedManifest, documentation, source),
    ).toThrow('action.yml: inputs entries must be named mappings')
  })

  it('reports a newly supported runtime mode by exact name', () => {
    const changedSource = source.replace(
      '    default: {',
      "    case 'firewall-enterprise': {\n      break\n    }\n    default: {",
    )
    expect(
      checkActionDocumentation(manifest, documentation, changedSource),
    ).toContain('Modes is missing firewall-enterprise')
  })

  it('rejects a runtime mode documented as unsupported', () => {
    const changedSource = source.replace(
      "    case 'firewall': {",
      "    case 'firewall': {\n      break\n    }\n    case 'cli': {",
    )
    expect(
      checkActionDocumentation(manifest, documentation, changedSource),
    ).toContain('Modes cli supported is No; expected Yes')
  })
})
