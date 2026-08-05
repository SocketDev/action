/**
 * @file Minimal GitHub Actions exec slice — the surface of `@actions/exec`
 *   this action consumes (spawn a tool, stream its output, resolve the exit
 *   code), re-homed on the fleet spawn wrapper so the npm dependency stays
 *   out of the supply chain. Semantics mirror `@actions/exec@1.1.1` for that
 *   surface: output streams to the live console by default, `silent`
 *   suppresses it, `listeners.stdout`/`listeners.stderr` receive Buffer
 *   chunks, and a non-zero exit rejects with the upstream error message
 *   unless `ignoreReturnCode` is set. Unlike upstream, `commandLine` is the
 *   tool path or name only — arguments always travel in `args`.
 */

import { spawn } from '@socketsecurity/lib-stable/process/spawn/child'
import { isSpawnExitError } from '@socketsecurity/lib-stable/process/spawn/errors'

/**
 * Executes a command and resolves its exit code.
 *
 * @param {string} commandLine - Path or name of the tool to execute.
 * @param {string[]} [args] - Arguments for the tool.
 * @param {{
 *   cwd?: string
 *   ignoreReturnCode?: boolean
 *   listeners?: {
 *     stdout?: (data: Buffer) => void
 *     stderr?: (data: Buffer) => void
 *   }
 *   silent?: boolean
 * }} [options]
 *   Exec options.
 *
 * @returns {Promise<number>} The exit code.
 */
export async function execCommand(commandLine, args = [], options = {}) {
  if (!commandLine) {
    throw new Error(`Parameter 'commandLine' cannot be null or empty.`)
  }
  const opts = { __proto__: null, ...options }
  const listeners = { __proto__: null, ...opts.listeners }
  const silent = !!opts.silent
  // Pipe the output only when someone consumes it (a listener) or wants it
  // gone (silent); otherwise inherit the parent's stdio so the tool writes
  // straight to the live console.
  const piped = silent || !!listeners.stdout || !!listeners.stderr
  const result = spawn(commandLine, args, {
    ...(opts.cwd ? { cwd: opts.cwd } : {}),
    stdio: piped ? 'pipe' : 'inherit',
    // Keep chunks as Buffers so listeners see the same shape upstream fed
    // them, and so binary output is never mangled by string decoding.
    stdioString: false,
  })
  if (piped) {
    result.process.stdout?.on('data', data => {
      if (listeners.stdout) {
        listeners.stdout(data)
      }
      if (!silent) {
        process.stdout.write(data)
      }
    })
    result.process.stderr?.on('data', data => {
      if (listeners.stderr) {
        listeners.stderr(data)
      }
      if (!silent) {
        process.stderr.write(data)
      }
    })
  }
  try {
    const { code } = await result
    return code
  } catch (e) {
    // A process that ran and exited non-zero carries a numeric code; a
    // launch failure (ENOENT and friends) does not and is rethrown as-is.
    if (isSpawnExitError(e)) {
      if (opts.ignoreReturnCode) {
        return e.code
      }
      throw new Error(
        `The process '${commandLine}' failed with exit code ${e.code}`,
      )
    }
    throw e
  }
}
