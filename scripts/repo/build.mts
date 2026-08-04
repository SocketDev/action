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

import process from 'node:process'

import { errorMessage } from '@socketsecurity/lib-stable/errors/message'
import { safeDelete } from '@socketsecurity/lib-stable/fs/safe'
import { getDefaultLogger } from '@socketsecurity/lib-stable/logger/default'
import { build } from 'rolldown'

import { actionBundles } from '../../.config/repo/rolldown.config.mts'
import { ACTION_DIST_DIR } from './paths.mts'

const logger = getDefaultLogger()

export async function main(): Promise<void> {
  await safeDelete(ACTION_DIST_DIR, { force: true, recursive: true })

  // Sequential on purpose: every bundle writes into the same `dist/` dir.
  for (const bundle of actionBundles) {
    logger.log(`→ bundling ${bundle.outputFile} (rolldown)`)
    await build(bundle.config)
  }

  logger.success('build complete')
}

main().catch((e: unknown) => {
  logger.error(`Build failed: ${errorMessage(e)}`)
  process.exitCode = 1
})
