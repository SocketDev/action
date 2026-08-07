#!/usr/bin/env node
// Run the pre-push gate — the deterministic executor for the fleet push
// workflow. The LAW lives in the post-push-ci-monitor-nudge hook + the CLAUDE.md
// push bullet; this is the convenience runner that sequences the gate so a push
// is never sent on a red tree.
//
// Runs, in order (stops + fails loud on the first red step):
//   1. pnpm run update      — refresh tool/catalog pins, soak-held held
//   2. pnpm install         — reconcile the lockfile
//   3. pnpm run fix --all   — lint/format autofix
//   4. pnpm run check --all --release — the fleet check gates, FULL tier
//      (--release opts the interactive-skipped long poles + release/network
//      checks back in, so a push is gated on the complete set, not the fast
//      interactive subset).
//   5. pnpm run cover       — full coverage suite (covers "all tests pass")
//
// On all-green it prints the next step (push + watch CI). It does NOT push —
// pushing is a deliberate act the operator does after seeing green (the
// post-push-ci-monitor-nudge then reminds to drive CI to green). Landing on
// local main is the default; this gate guards the push when you choose to.
//
// Usage: node scripts/fleet/pre-push-gate.mts

import { spawn } from '@socketsecurity/lib-stable/process/spawn/child'
import process from 'node:process'

import { getDefaultLogger } from '@socketsecurity/lib-stable/logger/default'
import { isMainModule } from './_shared/is-main-module.mts'
import { runMain } from './_shared/run-main.mts'

import type { ScriptMeta } from './_shared/run-main.mts'

const logger = getDefaultLogger()

// Steps that must succeed IN ORDER before anything can be verified: each one
// feeds the next, so a failure here makes every later result meaningless. These
// still stop the gate at the first red.
export const PREPARE_STEPS: ReadonlyArray<
  readonly [string, readonly string[]]
> = [
  ['pnpm', ['run', 'update']],
  ['pnpm', ['install']],
]

// The cheap verifications. Independent of each other, so they ALL run and every
// red is reported together: one pass hands over the whole cheap blocker set.
//
// They used to stop at the first red, which turned the gate into a discovery
// loop — run, read one failure, fix, run again — and a lint failure says nothing
// about whether the checks pass, so stopping bought nothing.
export const FAST_VERIFY_STEPS: ReadonlyArray<
  readonly [string, readonly string[]]
> = [
  ['pnpm', ['run', 'fix', '--all']],
  ['pnpm', ['run', 'check', '--all', '--release']],
]

// The expensive verification, gated behind a clean fast pass. `cover` is the
// full suite and by far the longest step, so paying for it while lint or a check
// is already red is the long cycle worth avoiding: its result would be thrown
// away the moment the cheap reds are fixed and everything re-runs anyway.
//
// So the shape is: accumulate the cheap set, THEN fail fast before the slow one.
export const SLOW_VERIFY_STEPS: ReadonlyArray<
  readonly [string, readonly string[]]
> = [['pnpm', ['run', 'cover']]]

// Every verification, cheap first. Exported for callers that want the list
// rather than the phasing.
export const VERIFY_STEPS: ReadonlyArray<readonly [string, readonly string[]]> =
  [...FAST_VERIFY_STEPS, ...SLOW_VERIFY_STEPS]

// The whole gate, in run order. Kept for callers that just want the sequence.
export const GATE_STEPS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ...PREPARE_STEPS,
  ...VERIFY_STEPS,
]

export interface GateDeps {
  runStep?:
    | ((cmd: string, args: readonly string[]) => Promise<number>)
    | undefined
}

export interface GateResult {
  ok: boolean
  // The first failing step, present only when !ok. Kept so existing callers
  // reading a single name still work; `failedAll` carries the full set.
  failed?: string | undefined
  // EVERY failing step, in run order. A prepare failure short-circuits, so this
  // holds one entry then; a verify failure collects all of them.
  failedAll?: readonly string[] | undefined
}

export async function defaultRunStep(
  cmd: string,
  args: readonly string[],
): Promise<number> {
  logger.log(`[pre-push-gate] → ${cmd} ${args.join(' ')}`)
  try {
    await spawn(cmd, [...args], { stdio: 'inherit' })
    return 0
  } catch (e) {
    const code = (e as { code?: unknown | undefined } | undefined)?.code
    return typeof code === 'number' ? code : 1
  }
}

/**
 * Three phases, chosen so one run hands over the whole cheap blocker set
 * without ever paying the slow suite for a tree that is already red:
 *
 * 1. PREPARE — in order, stop at the first red; each step feeds the next.
 * 2. FAST_VERIFY — all of them run, every red collected.
 * 3. SLOW_VERIFY — only when phase 2 was clean.
 *
 * Returns `{ ok: true }` only when every step passed. On failure `failedAll`
 * names every red found in the phase that failed.
 */
export async function runGate(
  deps?: GateDeps | undefined,
): Promise<GateResult> {
  const opts = {
    __proto__: null,
    runStep: defaultRunStep,
    ...deps,
  } as { [K in keyof GateDeps]-?: NonNullable<GateDeps[K]> }
  for (let i = 0, { length } = PREPARE_STEPS; i < length; i += 1) {
    const [cmd, args] = PREPARE_STEPS[i]!
    const code = await opts.runStep(cmd, args)
    if (code !== 0) {
      const label = `${cmd} ${args.join(' ')}`
      return { ok: false, failed: label, failedAll: [label] }
    }
  }
  const failedAll: string[] = []
  for (let i = 0, { length } = FAST_VERIFY_STEPS; i < length; i += 1) {
    const [cmd, args] = FAST_VERIFY_STEPS[i]!
    const code = await opts.runStep(cmd, args)
    if (code !== 0) {
      failedAll.push(`${cmd} ${args.join(' ')}`)
    }
  }
  // Fail fast before the slow suite: its verdict would be discarded anyway once
  // the cheap reds are fixed and the gate re-runs.
  if (failedAll.length) {
    return { ok: false, failed: failedAll[0], failedAll }
  }
  for (let i = 0, { length } = SLOW_VERIFY_STEPS; i < length; i += 1) {
    const [cmd, args] = SLOW_VERIFY_STEPS[i]!
    const code = await opts.runStep(cmd, args)
    if (code !== 0) {
      failedAll.push(`${cmd} ${args.join(' ')}`)
    }
  }
  if (failedAll.length) {
    return { ok: false, failed: failedAll[0], failedAll }
  }
  return { ok: true }
}

export async function main(): Promise<void> {
  const result = await runGate()
  if (!result.ok) {
    const reds = result.failedAll ?? [result.failed ?? 'unknown step']
    logger.fail(
      reds.length === 1
        ? `[pre-push-gate] RED at \`${reds[0]}\` — fix it before pushing; nothing pushed.`
        : `[pre-push-gate] RED at ${reds.length} steps — fix ALL of them before pushing; nothing pushed.`,
    )
    if (reds.length > 1) {
      for (let i = 0, { length } = reds; i < length; i += 1) {
        logger.error(`    ${reds[i]}`)
      }
      logger.log(
        '  Every verification ran on purpose, so this is the whole blocker set.' +
          ' Re-running the gate to find the next one pays another full' +
          ' `check --all` + `cover` for information you already have.',
      )
    }
    process.exitCode = 1
    return
  }
  logger.success('[pre-push-gate] GREEN — safe to push.')
  logger.log(
    '  Next: push, then drive CI to green —\n' +
      '    git push\n' +
      '    gh run watch   # the post-push-ci-monitor-nudge reminds you',
  )
}

const SCRIPT_META: ScriptMeta = {
  describe:
    'sequences the full pre-push gate (update, install, fix, check, cover) and stops on the first red step',
  help: 'Usage: node scripts/fleet/pre-push-gate.mts',
}

if (isMainModule(import.meta.url)) {
  runMain(main, SCRIPT_META)
}
