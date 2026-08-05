// The first-party @actions/tool-cache slice (src/toolkit/tool-cache.js) —
// the RUNNER_TOOL_CACHE/<tool>/<version>/<arch> + .complete layout via
// cacheFile/cacheDir/find, downloads through a stubbed global fetch plus
// nock net-lockdown (no network), retry classification, and tar/zip
// extraction through the real archivers into temp dirs.

import assert from 'node:assert/strict'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import nock from 'nock'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { execCommand } from '../../../src/toolkit/exec.js'
import { which } from '../../../src/toolkit/io.js'
import {
  HTTPError,
  cacheDir,
  cacheFile,
  downloadTool,
  extractTar,
  extractZip,
  findTool,
  isRetryableDownloadError,
  semverClean,
  toolCache,
} from '../../../src/toolkit/tool-cache.js'

let cacheRoot: string
let tempRoot: string
let tmpDir: string

/**
 * A minimal single-file ZIP (store method, no compression) so the extractZip
 * test needs no zip binary — local file header + central directory + EOCD.
 */
function buildStoredZip(name: string, data: Buffer): Buffer {
  const nameBuf = Buffer.from(name)
  const crc = crc32(data)
  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(20, 4)
  local.writeUInt32LE(crc, 14)
  local.writeUInt32LE(data.length, 18)
  local.writeUInt32LE(data.length, 22)
  local.writeUInt16LE(nameBuf.length, 26)
  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0)
  central.writeUInt16LE(20, 4)
  central.writeUInt16LE(20, 6)
  central.writeUInt32LE(crc, 16)
  central.writeUInt32LE(data.length, 20)
  central.writeUInt32LE(data.length, 24)
  central.writeUInt16LE(nameBuf.length, 28)
  const localRecord = Buffer.concat([local, nameBuf, data])
  const centralRecord = Buffer.concat([central, nameBuf])
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(1, 8)
  eocd.writeUInt16LE(1, 10)
  eocd.writeUInt32LE(centralRecord.length, 12)
  eocd.writeUInt32LE(localRecord.length, 16)
  return Buffer.concat([localRecord, centralRecord, eocd])
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff
  for (const byte of buf) {
    crc ^= byte
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

beforeEach(() => {
  // Fail closed on any live connection; every download in this file goes
  // through the stubbed global fetch.
  nock.disableNetConnect()
  tmpDir = mkdtempSync(path.join(os.tmpdir(), 'toolkit-tool-cache-'))
  cacheRoot = path.join(tmpDir, 'tool-cache')
  tempRoot = path.join(tmpDir, 'runner-temp')
  mkdirSync(cacheRoot, { recursive: true })
  mkdirSync(tempRoot, { recursive: true })
  vi.stubEnv('RUNNER_TOOL_CACHE', cacheRoot)
  vi.stubEnv('RUNNER_TEMP', tempRoot)
  // Zero the retry waits through the upstream test seam so retry paths run
  // instantly.
  Object.assign(globalThis, {
    TEST_DOWNLOAD_TOOL_RETRY_MAX_SECONDS: 0,
    TEST_DOWNLOAD_TOOL_RETRY_MIN_SECONDS: 0,
  })
})

afterEach(() => {
  nock.cleanAll()
  nock.enableNetConnect()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  delete (globalThis as Record<string, unknown>)[
    'TEST_DOWNLOAD_TOOL_RETRY_MIN_SECONDS'
  ]
  delete (globalThis as Record<string, unknown>)[
    'TEST_DOWNLOAD_TOOL_RETRY_MAX_SECONDS'
  ]
  rmSync(tmpDir, { force: true, recursive: true })
})

describe('downloadTool', () => {
  test('streams the response body to a GUID file under RUNNER_TEMP', async () => {
    const fetchMock = vi.fn(async () => new Response('binary payload'))
    vi.stubGlobal('fetch', fetchMock)
    const dest = await downloadTool('https://example.test/asset')
    assert.ok(dest.startsWith(tempRoot))
    assert.equal(readFileSync(dest, 'utf8'), 'binary payload')
    assert.equal(fetchMock.mock.calls.length, 1)
  })

  test('honors an explicit dest and passes the auth header', async () => {
    const fetchMock = vi.fn(async () => new Response('authed'))
    vi.stubGlobal('fetch', fetchMock)
    const dest = path.join(tempRoot, 'nested', 'asset.bin')
    assert.equal(
      await downloadTool('https://example.test/asset', dest, 'token abc'),
      dest,
    )
    assert.equal(readFileSync(dest, 'utf8'), 'authed')
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    assert.equal(
      (init.headers as Record<string, string>)['authorization'],
      'token abc',
    )
  })

  test('rejects a 404 with the upstream HTTPError and does not retry', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response('nope', { status: 404, statusText: 'Not Found' }),
    )
    vi.stubGlobal('fetch', fetchMock)
    await expect(downloadTool('https://example.test/missing')).rejects.toThrow(
      'Unexpected HTTP response: 404',
    )
    assert.equal(fetchMock.mock.calls.length, 1)
  })

  test('retries a transient failure and succeeds on a later attempt', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(new Response('finally', { status: 500 }))
      .mockResolvedValueOnce(new Response('finally'))
    vi.stubGlobal('fetch', fetchMock)
    const dest = await downloadTool('https://example.test/flaky')
    assert.equal(readFileSync(dest, 'utf8'), 'finally')
    assert.equal(fetchMock.mock.calls.length, 3)
  })

  test('rejects when the destination file already exists', async () => {
    const fetchMock = vi.fn(async () => new Response('unused'))
    vi.stubGlobal('fetch', fetchMock)
    const dest = path.join(tempRoot, 'taken.bin')
    writeFileSync(dest, 'occupied')
    await expect(
      downloadTool('https://example.test/asset', dest),
    ).rejects.toThrow(`Destination file path ${dest} already exists`)
    assert.equal(fetchMock.mock.calls.length, 0)
  })
})

describe('isRetryableDownloadError', () => {
  test('does not retry client errors except 408 and 429', () => {
    assert.equal(isRetryableDownloadError(new HTTPError(404)), false)
    assert.equal(isRetryableDownloadError(new HTTPError(408)), true)
    assert.equal(isRetryableDownloadError(new HTTPError(429)), true)
    assert.equal(isRetryableDownloadError(new HTTPError(500)), true)
    assert.equal(isRetryableDownloadError(new TypeError('fetch failed')), true)
  })
})

describe('cacheFile + find', () => {
  test('writes <cache>/<tool>/<version>/<arch> with a .complete marker that find honors', async () => {
    const source = path.join(tempRoot, 'downloaded-guid')
    writeFileSync(source, 'sfw binary bytes')
    const cached = await cacheFile(source, 'sfw', 'firewall', 'v1.6.1', 'arm64')
    assert.equal(cached, path.join(cacheRoot, 'firewall', '1.6.1', 'arm64'))
    assert.equal(
      readFileSync(path.join(cached, 'sfw'), 'utf8'),
      'sfw binary bytes',
    )
    assert.ok(existsSync(`${cached}.complete`))
    assert.equal(findTool('firewall', 'v1.6.1', 'arm64'), cached)
  })

  test('find misses when the .complete marker is absent', async () => {
    const source = path.join(tempRoot, 'downloaded-guid')
    writeFileSync(source, 'bytes')
    const cached = await cacheFile(source, 'sfw', 'firewall', '1.6.1', 'arm64')
    rmSync(`${cached}.complete`)
    assert.equal(findTool('firewall', '1.6.1', 'arm64'), '')
  })

  test('find returns an empty string for a non-explicit version spec', () => {
    assert.equal(findTool('firewall', 'latest', 'arm64'), '')
  })

  test('rejects a source that is not a file', async () => {
    await expect(
      cacheFile(tempRoot, 'sfw', 'firewall', '1.0.0', 'arm64'),
    ).rejects.toThrow('sourceFile is not a file')
  })
})

describe('cacheDir + find', () => {
  test('copies the directory contents into the versioned cache path', async () => {
    const source = path.join(tempRoot, 'extracted')
    mkdirSync(path.join(source, 'sub'), { recursive: true })
    writeFileSync(path.join(source, 'socket-patch'), 'patch binary')
    writeFileSync(path.join(source, 'sub', 'notes.txt'), 'nested')
    const cached = await cacheDir(source, 'socket-patch', 'v2.3.4', 'x64')
    assert.equal(cached, path.join(cacheRoot, 'socket-patch', '2.3.4', 'x64'))
    assert.equal(
      readFileSync(path.join(cached, 'socket-patch'), 'utf8'),
      'patch binary',
    )
    assert.equal(
      readFileSync(path.join(cached, 'sub', 'notes.txt'), 'utf8'),
      'nested',
    )
    assert.equal(findTool('socket-patch', 'v2.3.4', 'x64'), cached)
  })

  test('rejects a source that is not a directory', async () => {
    const source = path.join(tempRoot, 'plain-file')
    writeFileSync(source, 'not a dir')
    await expect(
      cacheDir(source, 'socket-patch', '1.0.0', 'x64'),
    ).rejects.toThrow('sourceDir is not a directory')
  })
})

describe('extractTar', () => {
  test('extracts a gzipped tar into a GUID dir under RUNNER_TEMP', async () => {
    const stage = path.join(tempRoot, 'stage')
    mkdirSync(stage, { recursive: true })
    writeFileSync(path.join(stage, 'tool.txt'), 'tar payload')
    const archive = path.join(tempRoot, 'tool.tar.gz')
    await execCommand('tar', ['-czf', archive, '-C', stage, '.'], {
      silent: true,
    })
    const dest = await extractTar(archive)
    assert.ok(dest.startsWith(tempRoot))
    assert.equal(
      readFileSync(path.join(dest, 'tool.txt'), 'utf8'),
      'tar payload',
    )
  })

  test('requires the file parameter', async () => {
    await expect(extractTar('')).rejects.toThrow("parameter 'file' is required")
  })
})

describe('extractZip', () => {
  test('extracts a zip into a GUID dir under RUNNER_TEMP', async ctx => {
    if (!(await which('unzip', false))) {
      ctx.skip()
      return
    }
    const archive = path.join(tempRoot, 'tool.zip')
    writeFileSync(
      archive,
      buildStoredZip('tool.txt', Buffer.from('zip payload')),
    )
    const dest = await extractZip(archive)
    assert.ok(dest.startsWith(tempRoot))
    assert.equal(
      readFileSync(path.join(dest, 'tool.txt'), 'utf8'),
      'zip payload',
    )
  })

  test('requires the file parameter', async () => {
    await expect(extractZip('')).rejects.toThrow("parameter 'file' is required")
  })
})

describe('semverClean', () => {
  test('cleans loose prefixes and rejects non-explicit specs', () => {
    assert.equal(semverClean('v1.6.1'), '1.6.1')
    assert.equal(semverClean('=1.2.3'), '1.2.3')
    assert.equal(semverClean(' 1.2.3-rc.1 '), '1.2.3-rc.1')
    assert.equal(semverClean('latest'), undefined)
    assert.equal(semverClean('1.2'), undefined)
  })
})

describe('toolCache aggregate', () => {
  test('exposes the consumed surface', () => {
    assert.equal(toolCache.cacheDir, cacheDir)
    assert.equal(toolCache.cacheFile, cacheFile)
    assert.equal(toolCache.downloadTool, downloadTool)
    assert.equal(toolCache.extractTar, extractTar)
    assert.equal(toolCache.extractZip, extractZip)
    assert.equal(toolCache.find, findTool)
    assert.equal(toolCache.HTTPError, HTTPError)
  })
})
