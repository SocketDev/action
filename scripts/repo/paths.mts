/**
 * @file Repo-specific path constants. Inherits every fleet path by re-export
 *   (the "1 path, 1 reference" mantra) and adds only the two directories this
 *   repo owns: the action sources and the committed bundle a workflow runner
 *   executes.
 */

import path from 'node:path'

import { REPO_ROOT } from '../fleet/paths.mts'

export * from '../fleet/paths.mts'

/**
 * The committed bundle. A consumer resolves `SocketDev/action@<tag>` straight
 * from the git tree, so these are the exact bytes a workflow runner executes —
 * `action.yml` names `main.js` and `post.js` inside this directory. Written by
 * `scripts/repo/build.mts`, never hand-edited.
 *
 * Named apart from the fleet's own `DIST_DIR` (the hook bundle) so the
 * re-export above stays unambiguous.
 */
export const ACTION_DIST_DIR = path.join(REPO_ROOT, 'dist')

/**
 * The action sources `ACTION_DIST_DIR` is built from.
 */
export const ACTION_SRC_DIR = path.join(REPO_ROOT, 'src')
