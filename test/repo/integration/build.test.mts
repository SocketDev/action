/**
 * @file Verifies action bundle bytes do not depend on checkout paths.
 */

import { build } from 'rolldown'
import { describe, expect, it } from 'vitest'

import { actionBundles } from '../../../.config/repo/rolldown.config.mts'
import type { ActionBundle } from '../../../.config/repo/rolldown.config.mts'

async function buildFixture(
  config: ActionBundle['config'],
  input: string,
): Promise<string> {
  const result = await build({
    ...config,
    input,
    plugins: [
      {
        name: 'example-entry',
        resolveId: id => (id === input ? id : undefined),
        load: id =>
          id === input
            ? '/*! @license MIT */\nexport const exampleValue = 42'
            : undefined,
      },
    ],
    write: false,
  })
  const chunk = result.output.find(output => output.type === 'chunk')
  expect(chunk).toBeDefined()
  return chunk!.code
}

describe('action bundle reproducibility', () => {
  it.each(actionBundles)(
    'preserves identical bytes for $outputFile across checkout paths',
    async ({ config }) => {
      const first = await buildFixture(
        config,
        '/example-macos/workspace/entry.js',
      )
      const second = await buildFixture(
        config,
        '/example-linux/workspace/entry.js',
      )
      expect(first).toBe(second)
      expect(first).toContain('@license MIT')
      expect(first).toContain('exampleValue = 42')
    },
  )
})
