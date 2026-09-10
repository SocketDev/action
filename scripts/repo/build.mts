/*
 * @file Build runner: bundles `src/main.js` and `src/post.js` into the
 *   committed `dist/` with rolldown.
 *
 *   `dist/` is the artifact a consumer executes — the runner checks this repo
 *   out at a tag and runs `dist/main.js` / `dist/post.js` directly — so the
 *   output of this script has to be committed in the same change as any `src/`
 *   edit. `committed-dist-is-current` is the gate that catches a miss.
 *
 *   The rolldown input/output/externals live in
 *   `.config/repo/rolldown.config.mts`; this runner just clears `dist/` and
 *   walks the bundles in order.
 */

import { safeDelete } from '@socketsecurity/lib-stable/fs/safe'
import { build } from 'rolldown'

import { actionBundles } from '../../.config/repo/rolldown.config.mts'
import { isMainModule } from '../fleet/process/is-main-module.mts'
import { runMain } from '../fleet/process/run-main.mts'
import { getScriptLogger } from '../fleet/process/script-output.mts'
import { ACTION_DIST_DIR } from './paths.mts'

import type { ScriptMeta } from '../fleet/process/run-main.mts'

export const SCRIPT_META: ScriptMeta = {
  describe: 'Build the committed GitHub Action bundles.',
  help: 'Usage: pnpm run build [--json]',
  json: 'result',
}

export async function main(): Promise<void> {
  const logger = getScriptLogger()
  await safeDelete(ACTION_DIST_DIR, { recursive: true })

  // Sequential on purpose: every bundle writes into the same `dist/` dir.
  for (const bundle of actionBundles) {
    logger.log(`→ bundling ${bundle.outputFile} (rolldown)`)
    await build(bundle.config)
  }

  logger.success('build complete')
}

if (isMainModule(import.meta.url)) {
  runMain(main, SCRIPT_META)
}
