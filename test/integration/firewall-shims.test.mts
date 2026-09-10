/**
 * @file Exercises firewall routing and final PATH validation across setup
 *   order.
 */

import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { safeDelete } from '@socketsecurity/lib-stable/fs/safe'
import { spawnSync } from '@socketsecurity/lib/process/spawn/child'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { addPath } from '@actions/core'
import { main as postAction } from '../../src/post.js'
import { createFirewallShims } from '../../src/tools/firewall-shims.js'

const action = vi.hoisted(() => ({
  inputs: new Map<string, string>([['mode', 'patch']]),
  state: new Map<string, string>(),
}))

vi.mock(import('@actions/core'), async importOriginal => {
  const actual = await importOriginal()
  return {
    ...actual,
    getInput: (name: string) => action.inputs.get(name) ?? '',
    getState: (name: string) => action.state.get(name) ?? '',
    info: vi.fn(),
    saveState: (name: string, value: unknown) => {
      action.state.set(
        name,
        typeof value === 'string' ? value : JSON.stringify(value),
      )
    },
  }
})

let fixtureRoot: string

function writeExecutable(
  directory: string,
  name: string,
  body: string,
): string {
  mkdirSync(directory, { recursive: true })
  const filename = path.join(directory, name)
  writeFileSync(filename, `#!/bin/sh\n${body}\n`, { mode: 0o755 })
  return filename
}

function runNpm() {
  return spawnSync('npm', ['install', 'value with spaces'], {
    encoding: 'utf8',
    env: process.env,
  })
}

beforeEach(() => {
  fixtureRoot = mkdtempSync(path.join(os.tmpdir(), 'firewall-order-'))
  action.inputs.clear()
  action.inputs.set('mode', 'firewall-free')
  action.inputs.set('job-summary', 'none')
  action.state.clear()
  const pathFile = path.join(fixtureRoot, 'github-path')
  const envFile = path.join(fixtureRoot, 'github-env')
  writeFileSync(pathFile, '')
  writeFileSync(envFile, '')
  vi.stubEnv('GITHUB_PATH', pathFile)
  vi.stubEnv('GITHUB_ENV', envFile)
  vi.stubEnv('RUNNER_TEMP', fixtureRoot)
  vi.stubEnv('PATH', '/usr/bin:/bin')
  vi.stubEnv('SFW_SHIM_DIR', '')
  vi.stubEnv('SOCKET_SHIM_ACTIVE_NPM', '')
  vi.stubEnv('SOCKET_SHIM_ACTIVE_YARN', '')
  vi.stubEnv('SOCKET_SHIM_ACTIVE_PNPM', '')
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await safeDelete(fixtureRoot, { recursive: true })
})

describe.skipIf(process.platform === 'win32')('firewall setup order', () => {
  it('protects a different package manager started by the wrapped command', async () => {
    const runtimeDir = path.join(fixtureRoot, 'runtime')
    writeExecutable(
      runtimeDir,
      'npm',
      'printf "%s\\n" npm-manager\nexec yarn "$@"',
    )
    writeExecutable(runtimeDir, 'yarn', 'printf "%s\\n" yarn-manager "$@"')
    const firewall = writeExecutable(
      fixtureRoot,
      'sfw',
      'printf "%s\\n" firewall\nexec "$@"',
    )
    addPath(runtimeDir)
    await createFirewallShims(firewall, 'free')

    expect(runNpm()).toMatchObject({
      status: 0,
      stdout:
        'firewall\nnpm-manager\nfirewall\nyarn-manager\ninstall\nvalue with spaces',
    })
  })

  it('routes same-manager recursion directly and preserves the exit status', async () => {
    const runtimeDir = path.join(fixtureRoot, 'runtime')
    writeExecutable(
      runtimeDir,
      'npm',
      'if [ "$1" = "--child" ]; then\n  shift\n  printf "%s\\n" child-manager "$@"\n  exit 23\nfi\nprintf "%s\\n" parent-manager\nexec npm --child "$@"',
    )
    const firewall = writeExecutable(
      fixtureRoot,
      'sfw',
      'printf "%s\\n" firewall\nexec "$@"',
    )
    addPath(runtimeDir)
    await createFirewallShims(firewall, 'free')

    expect(runNpm()).toMatchObject({
      status: 23,
      stdout:
        'firewall\nparent-manager\nchild-manager\ninstall\nvalue with spaces',
    })
  })

  it('preserves literal shell characters in executable paths', async () => {
    const runtimeDir = path.join(fixtureRoot, "example runtime's $name & tools")
    writeExecutable(runtimeDir, 'npm', 'printf "%s\\n" npm-manager "$@"')
    const firewall = writeExecutable(
      runtimeDir,
      'sfw',
      'printf "%s\\n" firewall\nexec "$@"',
    )
    addPath(runtimeDir)
    await createFirewallShims(firewall, 'free')

    expect(runNpm()).toMatchObject({
      status: 0,
      stdout: 'firewall\nnpm-manager\ninstall\nvalue with spaces',
    })
  })

  it('does not turn an absent PATH into a literal undefined entry', async () => {
    vi.stubEnv('PATH', undefined)
    const firewall = writeExecutable(fixtureRoot, 'sfw', 'exec "$@"')
    await createFirewallShims(firewall, 'free')

    expect(process.env['PATH']).toBe(process.env['SFW_SHIM_DIR'])
  })

  it.each(['free', 'enterprise'])(
    'protects npm when runtime setup precedes %s firewall setup',
    async edition => {
      const runtimeDir = path.join(fixtureRoot, 'runtime')
      writeExecutable(runtimeDir, 'npm', 'printf "%s\\n" npm-manager "$@"')
      const firewall = writeExecutable(
        fixtureRoot,
        'sfw',
        'printf "%s\\n" firewall\nexec "$@"',
      )
      addPath(runtimeDir)
      await createFirewallShims(firewall, edition)
      action.inputs.set('mode', `firewall-${edition}`)

      expect(runNpm()).toMatchObject({
        status: 0,
        stdout: 'firewall\nnpm-manager\ninstall\nvalue with spaces',
      })
      await expect(postAction()).resolves.toBeUndefined()
    },
  )

  it.each(['free', 'enterprise'])(
    'rejects a later runtime shadowing %s firewall setup even without a summary',
    async edition => {
      const originalDir = path.join(fixtureRoot, 'original-runtime')
      writeExecutable(
        originalDir,
        'npm',
        'printf "%s\\n" original-manager "$@"',
      )
      const firewall = writeExecutable(
        fixtureRoot,
        'sfw',
        'printf "%s\\n" firewall\nexec "$@"',
      )
      addPath(originalDir)
      await createFirewallShims(firewall, edition)
      const laterDir = path.join(fixtureRoot, 'later-runtime')
      writeExecutable(laterDir, 'npm', 'printf "%s\\n" later-manager "$@"')
      addPath(laterDir)
      action.inputs.set('mode', `firewall-${edition}`)

      expect(runNpm()).toMatchObject({
        status: 0,
        stdout: 'later-manager\ninstall\nvalue with spaces',
      })
      await expect(postAction()).rejects.toMatchObject({
        code: 'SFW_SHIM_SHADOWED',
      })
    },
  )

  it('restores protection when the firewall action runs after a runtime change', async () => {
    const originalDir = path.join(fixtureRoot, 'original-runtime')
    writeExecutable(originalDir, 'npm', 'printf "%s\\n" original-manager')
    const firewall = writeExecutable(
      fixtureRoot,
      'sfw',
      'printf "%s\\n" firewall\nexec "$@"',
    )
    addPath(originalDir)
    await createFirewallShims(firewall, 'free')
    const laterDir = path.join(fixtureRoot, 'later-runtime')
    writeExecutable(laterDir, 'npm', 'printf "%s\\n" later-manager "$@"')
    addPath(laterDir)
    await createFirewallShims(firewall, 'free')

    expect(runNpm()).toMatchObject({
      status: 0,
      stdout: 'firewall\nlater-manager\ninstall\nvalue with spaces',
    })
    await expect(postAction()).resolves.toBeUndefined()
  })

  it('forwards arguments to a native executable without moving its path', async () => {
    const runtimeDir = path.join(fixtureRoot, 'runtime')
    mkdirSync(runtimeDir)
    symlinkSync(process.execPath, path.join(runtimeDir, 'pnpm'))
    const firewall = writeExecutable(
      fixtureRoot,
      'sfw',
      'printf "%s\\n" firewall\nexec "$@"',
    )
    addPath(runtimeDir)
    await createFirewallShims(firewall, 'free')

    const result = spawnSync(
      'pnpm',
      ['-p', 'process.argv[1]', 'value with spaces'],
      {
        encoding: 'utf8',
        env: process.env,
      },
    )
    expect(result.status).toBe(0)
    expect(result.stdout).toBe('firewall\nvalue with spaces')
    await expect(postAction()).resolves.toBeUndefined()
  })

  it('rejects a supported manager first installed after firewall setup', async () => {
    vi.stubEnv('PATH', '')
    const firewall = writeExecutable(fixtureRoot, 'sfw', 'exec "$@"')
    await createFirewallShims(firewall, 'enterprise')
    const laterDir = path.join(fixtureRoot, 'later-runtime')
    writeExecutable(laterDir, 'npm', 'exit 0')
    addPath(laterDir)
    action.inputs.set('job-summary', 'all')

    await expect(postAction()).rejects.toMatchObject({
      code: 'SFW_SHIM_SHADOWED',
    })
  })
})

describe('post action modes', () => {
  it.each(['firewall', 'firewall-free', 'firewall-enterprise'])(
    'allows explicit invocation without shim state in %s mode',
    async mode => {
      action.inputs.set('mode', mode)
      await expect(postAction()).resolves.toBeUndefined()
    },
  )

  it('keeps patch mode independent of firewall state', async () => {
    action.inputs.set('mode', 'patch')
    action.state.set('firewall-shims', 'invalid')
    await expect(postAction()).resolves.toBeUndefined()
  })
})
