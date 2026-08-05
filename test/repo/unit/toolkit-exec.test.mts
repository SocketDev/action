// The first-party @actions/exec slice (src/toolkit/exec.js) — exit-code
// resolution, the upstream failure message, ignoreReturnCode, listener
// streaming, silent suppression, and cwd handling, driven through real
// node child processes.

import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { execCommand } from '../../../src/toolkit/exec.js'

let stdout: string[]
let stdoutSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  stdout = []
  stdoutSpy = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation((chunk: unknown) => {
      stdout.push(String(chunk))
      return true
    })
})

afterEach(() => {
  stdoutSpy.mockRestore()
})

describe('exec', () => {
  test('resolves 0 for a succeeding command', async () => {
    assert.equal(await execCommand(process.execPath, ['-e', '']), 0)
  })

  test('rejects a non-zero exit with the upstream message shape', async () => {
    await expect(
      execCommand(process.execPath, ['-e', 'process.exit(3)'], {
        silent: true,
      }),
    ).rejects.toThrow(
      `The process '${process.execPath}' failed with exit code 3`,
    )
  })

  test('resolves the non-zero exit code when ignoreReturnCode is set', async () => {
    assert.equal(
      await execCommand(process.execPath, ['-e', 'process.exit(7)'], {
        ignoreReturnCode: true,
        silent: true,
      }),
      7,
    )
  })

  test('rejects when the tool cannot be launched', async () => {
    await expect(
      execCommand('definitely-not-a-real-binary-3f9c'),
    ).rejects.toThrow(/definitely-not-a-real-binary-3f9c/)
  })

  test('throws for an empty commandLine', async () => {
    await expect(execCommand('')).rejects.toThrow(
      `Parameter 'commandLine' cannot be null or empty.`,
    )
  })

  test('feeds stdout listeners Buffer chunks and writes through to the console', async () => {
    const chunks: Buffer[] = []
    await execCommand(
      process.execPath,
      ['-e', 'process.stdout.write("marker-out")'],
      {
        listeners: { stdout: data => chunks.push(data) },
      },
    )
    assert.ok(Buffer.isBuffer(chunks[0]))
    assert.equal(Buffer.concat(chunks).toString(), 'marker-out')
    assert.ok(stdout.join('').includes('marker-out'))
  })

  test('feeds stderr listeners while capturing', async () => {
    const chunks: Buffer[] = []
    await execCommand(
      process.execPath,
      ['-e', 'process.stderr.write("marker-err")'],
      {
        listeners: { stderr: data => chunks.push(data) },
        silent: true,
      },
    )
    assert.equal(Buffer.concat(chunks).toString(), 'marker-err')
  })

  test('silent suppresses the console write-through', async () => {
    await execCommand(
      process.execPath,
      ['-e', 'process.stdout.write("hidden-marker")'],
      { silent: true },
    )
    assert.ok(!stdout.join('').includes('hidden-marker'))
  })

  test('honors the cwd option', async () => {
    const cwd = os.tmpdir()
    let captured = ''
    await execCommand(
      process.execPath,
      ['-e', 'process.stdout.write(process.cwd())'],
      {
        cwd,
        listeners: { stdout: data => (captured += data.toString()) },
        silent: true,
      },
    )
    // Compare realpaths: os.tmpdir() is a symlink on macOS.
    assert.equal(path.basename(captured), path.basename(cwd))
  })
})
