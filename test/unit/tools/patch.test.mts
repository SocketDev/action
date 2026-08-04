/**
 * @file Covers the distribution table in `src/tools/patch.js` and the
 *   fail-fast branch that reads it. socket-patch ships archives rather than
 *   bare binaries, so each entry carries both an asset name and the format the
 *   action has to unpack — a mismatch between the two picks the wrong
 *   extractor and fails mid-job.
 */

import { afterEach, describe, expect, it } from 'vitest'

import {
  applyPatches,
  PATCH_DISTRIBUTIONS,
  PATCH_EXEC_NAME,
} from '../../../src/tools/patch.js'

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

describe('PATCH_DISTRIBUTIONS', () => {
  it('covers every platform socket-patch publishes', () => {
    expect(Object.keys(PATCH_DISTRIBUTIONS).toSorted()).toEqual([
      'darwin-arm64',
      'darwin-x64',
      'linux-arm',
      'linux-arm64',
      'linux-ia32',
      'linux-x64',
      'win32-arm64',
      'win32-ia32',
      'win32-x64',
    ])
  })

  it('pairs every asset with the extractor that can open it', () => {
    for (const [key, { archive, ext }] of Object.entries(PATCH_DISTRIBUTIONS)) {
      expect(archive.endsWith(`.${ext}`)).toBe(true)
      expect(ext).toBe(key.startsWith('win32-') ? 'zip' : 'tar.gz')
    }
  })
})

describe('PATCH_EXEC_NAME', () => {
  it('carries the .exe suffix only on Windows', () => {
    expect(PATCH_EXEC_NAME).toBe(
      process.platform === 'win32' ? 'socket-patch.exe' : 'socket-patch',
    )
  })
})

describe('applyPatches', () => {
  it('rejects an unsupported platform before reaching the network', async () => {
    restoreRuntimeTarget = overrideRuntimeTarget('sunos', 'sparc')
    await expect(applyPatches({})).rejects.toThrow(
      'Unsupported architecture sunos-sparc',
    )
  })

  it('rejects a supported platform on an unsupported arch', async () => {
    restoreRuntimeTarget = overrideRuntimeTarget('darwin', 'ia32')
    await expect(applyPatches({})).rejects.toThrow(
      'Unsupported architecture darwin-ia32',
    )
  })
})
