/**
 * @file Checks saved firewall command precedence, malformed state, and lookup
 *   failures.
 */

import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { safeDeleteSync } from '@socketsecurity/lib-stable/fs/safe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  assertFirewallShimPrecedence,
  createFirewallShims,
} from '../../../src/tools/firewall-shims.js'

const boundary = vi.hoisted(() => ({
  state: '',
  which:
    vi.fn<(command: string, check?: boolean | undefined) => Promise<string>>(),
}))

vi.mock(import('@actions/core'), async importOriginal => ({
  ...(await importOriginal()),
  addPath: vi.fn(),
  exportVariable: vi.fn(),
  getState: () => boundary.state,
  info: vi.fn(),
  saveState: vi.fn(),
}))
vi.mock(import('@actions/io'), async importOriginal => ({
  ...(await importOriginal()),
  which: boundary.which,
}))

const directory = path.resolve('example-firewall-shims')
const platform = Object.getOwnPropertyDescriptor(process, 'platform')!

beforeEach(() => {
  boundary.state = JSON.stringify({ commands: ['npm', 'pnpm'], directory })
  boundary.which.mockReset()
})

afterEach(() => {
  Object.defineProperty(process, 'platform', platform)
  vi.unstubAllEnvs()
})

describe('createFirewallShims', () => {
  it.each(['path segments', 'Windows case'])(
    'excludes a previous shim directory with equivalent %s',
    async variant => {
      const root = mkdtempSync(path.join(os.tmpdir(), 'firewall-lookup-'))
      const runtimeDir = path.join(root, 'runtime')
      const shimDir = path.join(root, 'sfw-shim')
      let previousShim = `${shimDir}${path.sep}.${path.sep}`
      if (variant === 'Windows case') {
        Object.defineProperty(process, 'platform', {
          configurable: true,
          value: 'win32',
        })
        previousShim = shimDir.toUpperCase()
      }
      vi.stubEnv('RUNNER_TEMP', root)
      vi.stubEnv('PATH', `${previousShim}${path.delimiter}${runtimeDir}`)
      const lookupPaths = new Set<string | undefined>()
      boundary.which.mockImplementation(async () => {
        lookupPaths.add(process.env['PATH'])
        return ''
      })
      try {
        await createFirewallShims(path.join(root, 'sfw'), 'free')
        expect([...lookupPaths]).toEqual([runtimeDir])
      } finally {
        safeDeleteSync(root, { recursive: true })
      }
    },
  )

  it('restores an absent PATH when command lookup fails', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'firewall-state-'))
    const failure = Object.assign(new Error('Fixture lookup failure'), {
      code: 'EACCES',
    })
    vi.stubEnv('RUNNER_TEMP', root)
    vi.stubEnv('PATH', undefined)
    boundary.which.mockRejectedValue(failure)
    try {
      await expect(
        createFirewallShims(path.join(root, 'sfw'), 'free'),
      ).rejects.toBe(failure)
      expect(process.env['PATH']).toBeUndefined()
    } finally {
      safeDeleteSync(root, { recursive: true })
    }
  })
})

describe('assertFirewallShimPrecedence', () => {
  it('does not query commands when automatic shims were not enabled', async () => {
    boundary.state = ''
    await expect(assertFirewallShimPrecedence()).resolves.toBeUndefined()
    expect(boundary.which).not.toHaveBeenCalled()
  })

  it('accepts the expected wrapper and an absent manager', async () => {
    const name = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    boundary.which
      .mockResolvedValueOnce(path.join(directory, name))
      .mockResolvedValueOnce('')
    await expect(assertFirewallShimPrecedence()).resolves.toBeUndefined()
    expect(boundary.which.mock.calls).toEqual([
      ['npm', false],
      ['pnpm', false],
    ])
  })

  it('matches Windows command wrappers without case sensitivity', async () => {
    Object.defineProperty(process, 'platform', {
      configurable: true,
      value: 'win32',
    })
    boundary.which.mockImplementation(async command =>
      path.join(directory, `${command}.cmd`).toUpperCase(),
    )
    await expect(assertFirewallShimPrecedence()).resolves.toBeUndefined()
  })

  it('rejects a different resolved executable', async () => {
    boundary.which.mockResolvedValue(path.resolve('example-runtime', 'npm'))
    await expect(assertFirewallShimPrecedence()).rejects.toMatchObject({
      code: 'SFW_SHIM_SHADOWED',
    })
  })

  it.each([
    'invalid json',
    'null',
    JSON.stringify({ commands: ['npm'], directory: 'relative-shims' }),
    JSON.stringify({ commands: [], directory }),
    JSON.stringify({ commands: ['../npm'], directory }),
  ])('rejects invalid action state %j', async state => {
    boundary.state = state
    await expect(assertFirewallShimPrecedence()).rejects.toMatchObject({
      code: 'SFW_SHIM_STATE_INVALID',
    })
    expect(boundary.which).not.toHaveBeenCalled()
  })

  it('preserves a command lookup failure', async () => {
    const failure = Object.assign(new Error('Fixture lookup failure'), {
      code: 'EACCES',
    })
    boundary.which.mockRejectedValue(failure)
    await expect(assertFirewallShimPrecedence()).rejects.toBe(failure)
  })
})
