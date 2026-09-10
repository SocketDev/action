/**
 * @file Covers the distribution table in `src/tools/patch.js` and the
 *   fail-fast branch that reads it. socket-patch ships archives rather than
 *   bare binaries, so each entry carries both an asset name and the format the
 *   action has to unpack — a mismatch between the two picks the wrong
 *   extractor and fails mid-job.
 */

import crypto from 'node:crypto'
import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { safeDelete } from '@socketsecurity/lib-stable/fs/safe'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  applyPatches,
  PATCH_DISTRIBUTIONS,
  PATCH_EXEC_NAME,
  patchCommandArgs,
  verifyChecksum,
} from '../../../src/tools/patch.js'

const { mockDownloadTool } = vi.hoisted(() => ({ mockDownloadTool: vi.fn() }))

vi.mock(import('@actions/tool-cache'), async importOriginal => ({
  ...(await importOriginal()),
  downloadTool: mockDownloadTool,
}))

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
let fixtureDirectory: string | undefined

afterEach(async () => {
  restoreRuntimeTarget?.()
  restoreRuntimeTarget = undefined
  mockDownloadTool.mockReset()
  if (fixtureDirectory) {
    await safeDelete(fixtureDirectory)
  }
  fixtureDirectory = undefined
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

describe('verifyChecksum', () => {
  it.each([
    { newline: '\n', matches: true },
    { newline: '\r\n', matches: true },
    { newline: '\r\n', matches: false },
  ])(
    'validates checksum with $newline lines and matching bytes: $matches',
    async ({ newline, matches }) => {
      fixtureDirectory = await mkdtemp(
        path.join(os.tmpdir(), 'patch-checksum-'),
      )
      const archiveName = 'example-archive.tar.gz'
      const archivePath = path.join(fixtureDirectory, archiveName)
      const checksumPath = path.join(fixtureDirectory, 'SHA256SUMS')
      const archiveBytes = Buffer.from('example archive bytes')
      const hash = crypto
        .createHash('sha256')
        .update(archiveBytes)
        .digest('hex')
      await writeFile(
        archivePath,
        matches ? archiveBytes : Buffer.from('corrupted archive bytes'),
      )
      await writeFile(checksumPath, `${hash}  ${archiveName}${newline}`)
      mockDownloadTool.mockResolvedValue(checksumPath)

      const verification = verifyChecksum(archivePath, 'v1.0.0', archiveName)
      if (matches) {
        await expect(verification).resolves.toBeUndefined()
      } else {
        await expect(verification).rejects.toThrow()
      }
      expect(mockDownloadTool).toHaveBeenCalledOnce()
    },
  )
})

describe('patchCommandArgs', () => {
  it('applies patches without optional filters', () => {
    expect(patchCommandArgs({})).toEqual(['apply'])
  })

  it('preserves ecosystem, dry-run, and working-directory options', () => {
    expect(
      patchCommandArgs({
        patchEcosystems: 'npm,cargo',
        patchDryRun: true,
        patchCwd: 'example workspace',
      }),
    ).toEqual([
      'apply',
      '--ecosystems',
      'npm,cargo',
      '--dry-run',
      '--cwd',
      'example workspace',
    ])
  })
})
