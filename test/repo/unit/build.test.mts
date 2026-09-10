/**
 * @file Tests the action build command and its structured entry contract.
 */

import process from 'node:process'

import { safeDelete } from '@socketsecurity/lib-stable/fs/safe'
import { getDefaultLogger } from '@socketsecurity/lib-stable/logger/default'
import { build } from 'rolldown'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { actionBundles } from '../../../.config/repo/rolldown.config.mts'
import { runMainAsync } from '../../../scripts/fleet/process/run-main.mts'
import { main, SCRIPT_META } from '../../../scripts/repo/build.mts'
import { ACTION_DIST_DIR } from '../../../scripts/repo/paths.mts'

vi.mock(import('@socketsecurity/lib-stable/fs/safe'), async original => ({
  ...(await original()),
  safeDelete: vi.fn(),
}))
vi.mock(import('rolldown'), async original => ({
  ...(await original()),
  build: vi.fn(),
}))

const originalArgv = process.argv
const originalExitCode = process.exitCode
const logger = getDefaultLogger()

beforeEach(() => {
  vi.mocked(safeDelete).mockReset()
  vi.mocked(build).mockReset()
  vi.spyOn(logger, 'log').mockImplementation(() => logger)
  vi.spyOn(logger, 'success').mockImplementation(() => logger)
  process.argv = ['node', 'build.mts']
  process.exitCode = undefined
})

afterEach(() => {
  vi.restoreAllMocks()
  process.argv = originalArgv
  process.exitCode = originalExitCode
})

describe('action build command', () => {
  it.each(['--help', '--describe'])(
    'answers %s without deleting or building artifacts',
    async flag => {
      process.argv.push(flag)
      await runMainAsync(main, SCRIPT_META)
      expect(process.exitCode).toBe(0)
      expect(logger.log).toHaveBeenCalledOnce()
      expect(safeDelete).not.toHaveBeenCalled()
      expect(build).not.toHaveBeenCalled()
    },
  )

  it('cleans once before building both configured outputs in order', async () => {
    await main()
    expect(safeDelete).toHaveBeenCalledExactlyOnceWith(ACTION_DIST_DIR, {
      recursive: true,
    })
    expect(build).toHaveBeenCalledTimes(actionBundles.length)
    for (const [index, bundle] of actionBundles.entries()) {
      expect(build).toHaveBeenNthCalledWith(index + 1, bundle.config)
    }
    expect(vi.mocked(safeDelete).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(build).mock.invocationCallOrder[0]!,
    )
  })

  it('stops before the second output when the first build rejects', async () => {
    const failure = new Error('Example bundler failure')
    vi.mocked(build).mockRejectedValueOnce(failure)
    await expect(main()).rejects.toBe(failure)
    expect(build).toHaveBeenCalledOnce()
  })

  it('returns a JSON success result after completing the build', async () => {
    process.argv.push('--json')
    await runMainAsync(main, SCRIPT_META)
    expect(process.exitCode).toBe(0)
    expect(build).toHaveBeenCalledTimes(actionBundles.length)
    expect(logger.log).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({ ok: true, exitCode: 0 }),
    )
  })

  it('returns a JSON failure result when cleanup rejects', async () => {
    const failure = new Error('Example cleanup failure')
    vi.mocked(safeDelete).mockRejectedValueOnce(failure)
    process.argv.push('--json')
    await runMainAsync(main, SCRIPT_META)
    expect(process.exitCode).toBe(1)
    expect(build).not.toHaveBeenCalled()
    expect(logger.log).toHaveBeenCalledOnce()
    const output: unknown = JSON.parse(
      String(vi.mocked(logger.log).mock.calls[0]?.[0]),
    )
    expect(output).toEqual({
      ok: false,
      exitCode: 1,
      error: expect.any(String),
    })
  })
})
