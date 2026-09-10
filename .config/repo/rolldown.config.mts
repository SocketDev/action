/*
 * @file Rolldown configuration for the two bundles a workflow runner executes.
 *
 *   `action.yml` names `dist/main.js` as the main step and `dist/post.js` as
 *   the post step, so each is its own single-entry, fully self-contained
 *   bundle. They are built separately rather than as one two-entry build so
 *   neither can end up importing a shared chunk file — the runner executes the
 *   named file directly and nothing guarantees a sibling chunk is on disk.
 *
 *   Output is ESM. The root package.json declares `"type": "module"` and
 *   `action.yml` pins the `node24` runner, so a `.js` file in this tree is
 *   loaded as ESM.
 *
 *   Every dependency is inlined and only Node builtins stay external: a
 *   consumer resolves `SocketDev/action@<tag>` straight from the git tree, so
 *   the runner executes the committed bundle with no `node_modules` beside it
 *   and anything left external would fail to resolve.
 *
 *   The output is NOT minified. `bundle-flags-guard` blocks minified shipped
 *   bundles fleet-wide: this artifact is committed and executed straight from
 *   the tree, so a reviewer has to be able to read it and a stack trace has to
 *   point at real code.
 */

import { builtinModules } from 'node:module'
import path from 'node:path'

import type { BuildOptions, Plugin } from 'rolldown'

import { ACTION_DIST_DIR, ACTION_SRC_DIR } from '../../scripts/repo/paths.mts'
import { createBundleStubPlugin } from '../fleet/rolldown/bundle-stub.mts'

// Node builtins, with and without the `node:` prefix. Everything else is
// bundled in.
const externals: string[] = [
  ...builtinModules,
  ...builtinModules.map(name => `node:${name}`),
]

/**
 * Stubs for the two subgraphs `@actions/core` statically pulls in that no
 * entry here calls into.
 *
 * `core.js` imports `OidcClient` solely to serve `getIDToken`, which reaches
 * `@actions/http-client` and through it undici and tunnel; it also carries
 * `export * as platform from './platform.js'`, and `platform.js` reaches
 * `@actions/exec` and through it `@actions/io`. Across `src/` the only names
 * taken from `@actions/core` are `addPath`, `debug`, `exportVariable`,
 * `getBooleanInput`, `getInput`, `info`, `setFailed`, `setOutput`, `setSecret`,
 * `summary`, and `warning` — neither `getIDToken` nor the `platform` namespace
 * is among them, so both trees are unreachable at runtime and rolldown keeps
 * them only because it cannot prove the module bodies pure.
 *
 * The payoff is lopsided. `post.js` imports nothing else that reaches those
 * packages, so stubbing drops them from its bundle outright. `main.js` reaches
 * `@actions/exec` and `@actions/io` from `firewall.js` and `patch.js` and
 * `@actions/http-client` from `@actions/tool-cache`, and reaches undici for
 * real through `getOctokit`, which builds a `ProxyAgent` whenever a proxy
 * variable is set — so it keeps all of them and loses only the two stubbed
 * files.
 *
 * Each stub is fail-loud rather than empty: a call that ever does reach it
 * throws by name instead of failing later on an undefined member.
 */
function coreStubPlugins(): Plugin[] {
  return [
    createBundleStubPlugin({
      stubPattern: /@actions\/core\/lib\/oidc-utils\.js$/,
      stubCode:
        'export class OidcClient {' +
        '  static getIDToken() {' +
        "    throw new Error('getIDToken is not bundled into this action');" +
        '  }' +
        '}',
    }),
    createBundleStubPlugin({
      // `core.js` re-exports this file as a namespace and nothing reads it, so
      // an empty module is the whole contract.
      stubPattern: /@actions\/core\/lib\/platform\.js$/,
      stubCode: 'export {}',
    }),
  ]
}

function entryConfig(name: string): BuildOptions {
  return {
    experimental: { attachDebugInfo: 'none' },
    external: externals,
    input: { [name]: path.join(ACTION_SRC_DIR, `${name}.js`) },
    output: {
      // The runner executes the committed file by name, so keep each bundle a
      // single file — a shared chunk beside it has nothing guaranteeing it is
      // on disk.
      codeSplitting: false,
      dir: ACTION_DIST_DIR,
      entryFileNames: '[name].js',
      format: 'esm',
      minify: false,
      sourcemap: false,
    },
    platform: 'node',
    plugins: coreStubPlugins(),
  }
}

/**
 * One bundle build.mts runs, paired with the `dist/` file it writes.
 */
export interface ActionBundle {
  readonly config: BuildOptions
  readonly outputFile: string
}

export const mainBundle: ActionBundle = {
  config: entryConfig('main'),
  outputFile: 'dist/main.js',
}

export const postBundle: ActionBundle = {
  config: entryConfig('post'),
  outputFile: 'dist/post.js',
}

// Every artifact build.mts emits, in order.
export const actionBundles: ActionBundle[] = [mainBundle, postBundle]
