// The first-party @actions/io slice (src/toolkit/io.js) — the which() PATH
// walk driven through a temp PATH fixture: execute-bit filtering, PATH
// ordering, rooted paths, separator rejection, and the upstream check-mode
// error.

import assert from 'node:assert/strict'
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { findInPath, io, which } from '../../../src/toolkit/io.js'

const IS_WINDOWS = process.platform === 'win32'

let pathSnapshot: string | undefined
let tmpDir: string

function fixtureBin(dir: string, name: string, mode: number): string {
  mkdirSync(dir, { recursive: true })
  const filePath = path.join(dir, name)
  writeFileSync(filePath, '#!/bin/sh\n')
  chmodSync(filePath, mode)
  return filePath
}

beforeEach(() => {
  pathSnapshot = process.env['PATH']
  tmpDir = mkdtempSync(path.join(os.tmpdir(), 'toolkit-io-'))
})

afterEach(() => {
  process.env['PATH'] = pathSnapshot
  rmSync(tmpDir, { force: true, recursive: true })
})

describe('which', () => {
  test('finds an executable on PATH and returns its full path', async () => {
    const binDir = path.join(tmpDir, 'bin')
    const expected = fixtureBin(binDir, 'fixture-tool', 0o755)
    process.env['PATH'] = binDir
    assert.equal(await which('fixture-tool', false), expected)
  })

  test('walks PATH left to right and returns the first match', async () => {
    const firstDir = path.join(tmpDir, 'first')
    const secondDir = path.join(tmpDir, 'second')
    const expected = fixtureBin(firstDir, 'dupe-tool', 0o755)
    fixtureBin(secondDir, 'dupe-tool', 0o755)
    process.env['PATH'] = `${firstDir}${path.delimiter}${secondDir}`
    assert.equal(await which('dupe-tool', false), expected)
  })

  test('returns an empty string for a missing tool when check is false', async () => {
    process.env['PATH'] = path.join(tmpDir, 'empty')
    assert.equal(await which('nothing-here', false), '')
  })

  test('throws the upstream error for a missing tool when check is true', async () => {
    process.env['PATH'] = path.join(tmpDir, 'empty')
    await expect(which('nothing-here', true)).rejects.toThrow(
      'Unable to locate executable file: nothing-here.',
    )
  })

  test.skipIf(IS_WINDOWS)('skips a file without the execute bit', async () => {
    const binDir = path.join(tmpDir, 'bin')
    fixtureBin(binDir, 'not-exec', 0o644)
    process.env['PATH'] = binDir
    assert.equal(await which('not-exec', false), '')
  })

  test('resolves a rooted path directly without a PATH walk', async () => {
    const binDir = path.join(tmpDir, 'rooted')
    const expected = fixtureBin(binDir, 'rooted-tool', 0o755)
    process.env['PATH'] = ''
    assert.equal(await which(expected, false), expected)
  })

  test('returns an empty string for a relative path containing separators', async () => {
    const binDir = path.join(tmpDir, 'bin')
    fixtureBin(binDir, 'sep-tool', 0o755)
    process.env['PATH'] = tmpDir
    assert.equal(await which(`bin${path.sep}sep-tool`, false), '')
  })

  test('throws the upstream message for an empty tool', async () => {
    await expect(which('', false)).rejects.toThrow(
      "parameter 'tool' is required",
    )
  })
})

describe('findInPath', () => {
  test('returns every PATH occurrence in order', async () => {
    const firstDir = path.join(tmpDir, 'first')
    const secondDir = path.join(tmpDir, 'second')
    const first = fixtureBin(firstDir, 'multi-tool', 0o755)
    const second = fixtureBin(secondDir, 'multi-tool', 0o755)
    process.env['PATH'] = `${firstDir}${path.delimiter}${secondDir}`
    assert.deepEqual(await findInPath('multi-tool'), [first, second])
  })

  test('is exposed on the io aggregate alongside which', () => {
    assert.equal(io.findInPath, findInPath)
    assert.equal(io.which, which)
  })
})
