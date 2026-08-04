/**
 * @file Covers the distribution table in `src/tools/firewall.js` and the
 *   fail-fast branch that reads it. The table is the thing that goes wrong in
 *   practice: a platform the firewall publishes for but the map omits turns
 *   into a 404 download at job time, and the map is the only place the action
 *   states which platforms it supports.
 */

import { afterEach, describe, expect, it } from 'vitest'

import {
  downloadFirewall,
  FIREWALL_DISTRIBUTIONS,
  FIREWALL_EXEC_NAME,
} from '../../../src/tools/firewall.js'

// `process.platform` and `process.arch` are plain own properties, so a test
// can redefine them and put the original descriptor back afterwards.
function overrideRuntimeTarget(platform: string, arch: string): () => void {
  const original = {
    arch: Object.getOwnPropertyDescriptor(process, 'arch')!,
    platform: Object.getOwnPropertyDescriptor(process, 'platform')!,
  }
  Object.defineProperty(process, 'platform', {
    configurable: true,
    value: platform,
  })
  Object.defineProperty(process, 'arch', { configurable: true, value: arch })
  return () => {
    Object.defineProperty(process, 'platform', original.platform)
    Object.defineProperty(process, 'arch', original.arch)
  }
}

let restoreRuntimeTarget: (() => void) | undefined

afterEach(() => {
  restoreRuntimeTarget?.()
  restoreRuntimeTarget = undefined
})

describe('FIREWALL_DISTRIBUTIONS', () => {
  it('covers every platform the README documents', () => {
    expect(Object.keys(FIREWALL_DISTRIBUTIONS).toSorted()).toEqual([
      'darwin-arm64',
      'darwin-x64',
      'linux-arm64',
      'linux-x64',
      'win32-arm64',
      'win32-x64',
    ])
  })

  it('gives every Windows build an .exe asset and no other build one', () => {
    for (const [key, asset] of Object.entries(FIREWALL_DISTRIBUTIONS)) {
      expect(asset.endsWith('.exe')).toBe(key.startsWith('win32-'))
    }
  })

  it('names each asset after its own platform', () => {
    expect(FIREWALL_DISTRIBUTIONS['darwin-arm64']).toBe('macos-arm64')
    expect(FIREWALL_DISTRIBUTIONS['linux-x64']).toBe('linux-x86_64')
    expect(FIREWALL_DISTRIBUTIONS['win32-x64']).toBe('windows-x86_64.exe')
  })
})

describe('FIREWALL_EXEC_NAME', () => {
  it('is the name later workflow steps call', () => {
    expect(FIREWALL_EXEC_NAME).toBe('sfw')
  })
})

describe('downloadFirewall', () => {
  it('rejects an unsupported platform before reaching the network', async () => {
    restoreRuntimeTarget = overrideRuntimeTarget('sunos', 'sparc')
    await expect(downloadFirewall({ edition: 'free' })).rejects.toThrow(
      'Unsupported architecture sunos-sparc',
    )
  })

  it('rejects a supported platform on an unsupported arch', async () => {
    restoreRuntimeTarget = overrideRuntimeTarget('linux', 'ppc64')
    await expect(downloadFirewall({ edition: 'free' })).rejects.toThrow(
      'Unsupported architecture linux-ppc64',
    )
  })
})
