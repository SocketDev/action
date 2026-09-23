/**
 * @file Covers the distribution table in `src/tools/firewall.js` and the
 *   fail-fast branch that reads it. The table is the thing that goes wrong in
 *   practice: a platform the firewall publishes for but the map omits turns
 *   into a 404 download at job time, and the map is the only place the action
 *   states which platforms it supports.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  downloadFirewall,
  downloadToolWithRetry,
  FIREWALL_DISTRIBUTIONS,
  FIREWALL_EXEC_NAME,
  firewallDownloadUrls,
  isRetryableDownloadError,
} from '../../../src/tools/firewall.js'

const { mockDownloadTool, sleepDelays } = vi.hoisted(() => ({
  mockDownloadTool: vi.fn(),
  sleepDelays: [] as number[],
}))

vi.mock(import('@actions/tool-cache'), async importOriginal => ({
  ...(await importOriginal()),
  downloadTool: mockDownloadTool,
}))

// The retry waits are real seconds; stubbing the sleep keeps the suite fast
// without weakening what the attempts assert. Recording each delay lets the
// tests pin the backoff schedule itself.
vi.mock(import('node:timers/promises'), async importOriginal => ({
  ...(await importOriginal()),
  setTimeout: async <T,>(
    delay?: number | undefined,
    value?: T | undefined,
  ): Promise<T> => {
    sleepDelays.push(delay ?? 0)
    return value as T
  },
}))

/**
 * Error shaped like the one `@actions/tool-cache` throws for an HTTP failure.
 */
function httpError(status: number): Error {
  return Object.assign(new Error(`Unexpected HTTP response: ${status}`), {
    httpStatusCode: status,
  })
}

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
  mockDownloadTool.mockReset()
  sleepDelays.length = 0
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

describe('isRetryableDownloadError', () => {
  it('retries a gateway failure, which is what a flaky asset CDN returns', () => {
    expect(isRetryableDownloadError(httpError(504))).toBe(true)
    expect(isRetryableDownloadError(httpError(500))).toBe(true)
    expect(isRetryableDownloadError(httpError(503))).toBe(true)
  })

  it('retries the two 4xx codes that mean "later", not "never"', () => {
    expect(isRetryableDownloadError(httpError(408))).toBe(true)
    expect(isRetryableDownloadError(httpError(429))).toBe(true)
  })

  it('gives up on a 4xx that will not change on a retry', () => {
    expect(isRetryableDownloadError(httpError(404))).toBe(false)
    expect(isRetryableDownloadError(httpError(403))).toBe(false)
  })

  it('retries an error that carries no status at all', () => {
    expect(isRetryableDownloadError(new Error('socket hang up'))).toBe(true)
  })
})

describe('downloadToolWithRetry', () => {
  const GITHUB = 'https://github.test/sfw'
  const MIRROR = 'https://mirror.test/sfw'

  it('returns the path once an attempt succeeds', async () => {
    mockDownloadTool
      .mockRejectedValueOnce(httpError(504))
      .mockResolvedValueOnce('/tmp/sfw')

    await expect(downloadToolWithRetry([GITHUB])).resolves.toBe('/tmp/sfw')
    expect(mockDownloadTool).toHaveBeenCalledTimes(2)
    expect(sleepDelays).toEqual([30_000])
  })

  it('rethrows the last error after exhausting its attempts', async () => {
    mockDownloadTool.mockRejectedValue(httpError(504))

    await expect(downloadToolWithRetry([GITHUB])).rejects.toThrow(
      'Unexpected HTTP response: 504',
    )
    expect(mockDownloadTool).toHaveBeenCalledTimes(3)
    expect(sleepDelays).toEqual([30_000, 60_000])
  })

  it('does not spend attempts on a missing asset', async () => {
    mockDownloadTool.mockRejectedValue(httpError(404))

    await expect(downloadToolWithRetry([GITHUB])).rejects.toThrow(
      'Unexpected HTTP response: 404',
    )
    expect(mockDownloadTool).toHaveBeenCalledTimes(1)
    expect(sleepDelays).toEqual([])
  })

  it('alternates origins across the retry schedule', async () => {
    mockDownloadTool.mockRejectedValue(httpError(504))

    await expect(downloadToolWithRetry([MIRROR, GITHUB])).rejects.toThrow(
      'Unexpected HTTP response: 504',
    )
    expect(mockDownloadTool.mock.calls).toEqual([[MIRROR], [GITHUB], [MIRROR]])
    expect(sleepDelays).toEqual([30_000, 60_000])
  })

  it('tries the other origin immediately when a retry cannot help', async () => {
    // A 404 from the mirror says nothing about GitHub: no backoff, one
    // immediate try of the other origin.
    mockDownloadTool
      .mockRejectedValueOnce(httpError(404))
      .mockResolvedValueOnce('/tmp/sfw')

    await expect(downloadToolWithRetry([MIRROR, GITHUB])).resolves.toBe(
      '/tmp/sfw',
    )
    expect(mockDownloadTool.mock.calls).toEqual([[MIRROR], [GITHUB]])
    expect(sleepDelays).toEqual([])
  })

  it('gives up once every origin reported a missing asset', async () => {
    mockDownloadTool.mockRejectedValue(httpError(404))

    await expect(downloadToolWithRetry([MIRROR, GITHUB])).rejects.toThrow(
      'Unexpected HTTP response: 404',
    )
    expect(mockDownloadTool).toHaveBeenCalledTimes(2)
    expect(sleepDelays).toEqual([])
  })
})

describe('firewallDownloadUrls', () => {
  it('gives the free edition both origins, ordered by the coin flip', () => {
    const github =
      'https://github.com/SocketDev/sfw-free/releases/download/v1.15.2/sfw-free-linux-x86_64'
    const mirror =
      'https://install.socket.dev/firewall/dl/v1.15.2/sfw-free-linux-x86_64'

    expect(
      firewallDownloadUrls(
        'free',
        'sfw-free',
        'v1.15.2',
        'sfw-free-linux-x86_64',
        () => 0.9,
      ),
    ).toEqual([github, mirror])
    expect(
      firewallDownloadUrls(
        'free',
        'sfw-free',
        'v1.15.2',
        'sfw-free-linux-x86_64',
        () => 0.1,
      ),
    ).toEqual([mirror, github])
  })

  it('keeps the enterprise edition GitHub-only', () => {
    expect(
      firewallDownloadUrls(
        'enterprise',
        'firewall-release',
        'v1.15.2',
        'sfw-windows-x86_64.exe',
        () => 0.1,
      ),
    ).toEqual([
      'https://github.com/SocketDev/firewall-release/releases/download/v1.15.2/sfw-windows-x86_64.exe',
    ])
  })
})
