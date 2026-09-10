/**
 * @file Creates firewall command wrappers and validates final command
 *   precedence.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'

import {
  addPath,
  exportVariable,
  getState,
  info,
  saveState,
} from '@actions/core'
import { which } from '@actions/io'
import { fromUnixPath } from '@socketsecurity/lib/paths/conversion'
import { normalizePath } from '@socketsecurity/lib/paths/normalize'
import { quote } from '@socketsecurity/lib/shell/quote'

export const FIREWALL_SHIM_STATE_KEY = 'firewall-shims'

/**
 * Directory under `RUNNER_TEMP` the generated shims are written to.
 */
export const FIREWALL_SHIM_DIR_NAME = 'sfw-shim'

export async function assertFirewallShimPrecedence() {
  const saved = getState(FIREWALL_SHIM_STATE_KEY)
  if (!saved) {
    return
  }
  const state = parseFirewallShimState(saved)
  const shadowed = []
  for (const command of state.commands) {
    const actual = await which(command, false)
    if (!actual) {
      continue
    }
    const expected = path.join(
      state.directory,
      process.platform === 'win32' ? `${command}.cmd` : command,
    )
    if (firewallCommandPath(actual) !== firewallCommandPath(expected)) {
      shadowed.push(command)
    }
  }
  if (shadowed.length) {
    throw Object.assign(
      new Error(
        `Firewall command precedence changed during the job: ${shadowed.join(', ')} resolve outside the expected firewall shim directory. Run runtime and package-manager setup before this action, or invoke sfw explicitly. This final check cannot protect earlier installs.`,
      ),
      { code: 'SFW_SHIM_SHADOWED' },
    )
  }
}

/**
 * Write a shim for every package manager sfw fronts and put the shim directory
 * first on PATH, so a workflow runs `npm install` rather than `sfw npm
 * install`. A per-command sentinel sends recursive calls to the real binary
 * while retaining protection for other package managers. Windows gets a
 * `.cmd` shim beside the shell one so cmd.exe and PowerShell are covered.
 *
 * @param {string} firewallBinaryPath Full path to the installed sfw binary.
 * @param {string} edition Edition installed, `free` or `enterprise`.
 */
export async function createFirewallShims(firewallBinaryPath, edition) {
  // Writing into a stable directory means a second run of the action in the
  // same job overwrites its own shims rather than stacking a new set.
  const shimDir = path.join(process.env.RUNNER_TEMP, FIREWALL_SHIM_DIR_NAME)
  await fs.mkdir(shimDir, { recursive: true })

  // Git Bash on a Windows runner hands out MSYS paths such as
  // `/c/Users/runner`, which cmd.exe and PowerShell cannot resolve.
  const firewallPath = fromUnixPath(firewallBinaryPath)

  const shimmed = []
  const commands = firewallShimCommands(edition)

  // `which` reads PATH from the environment, so the shim directory comes off
  // it for the whole lookup pass. A second run of the action in the same job
  // inherits the first run's shim directory, and without this the new shims
  // would point at the old ones instead of at the real binaries.
  const runnerPath = process.env.PATH
  const normalizedShimDir = firewallCommandPath(shimDir)

  process.env.PATH = (runnerPath ?? '')
    .split(path.delimiter)
    .filter(entry => firewallCommandPath(entry) !== normalizedShimDir)
    .join(path.delimiter)

  try {
    for (const command of commands) {
      const found = await which(command, false)

      // not installed on this runner, nothing to front
      if (!found) {
        continue
      }

      const realPath = fromUnixPath(found)
      const sentinel = `SOCKET_SHIM_ACTIVE_${command.toUpperCase()}`
      const shellShim = [
        '#!/bin/sh',
        `if [ -n "\${${sentinel}:-}" ]; then`,
        `  exec ${quote([realPath])} "$@"`,
        'fi',
        `export ${sentinel}=1`,
        `exec ${quote([firewallPath, realPath])} "$@"`,
      ].join('\n')

      await fs.writeFile(path.join(shimDir, command), `${shellShim}\n`, {
        mode: 0o755,
      })

      if (process.platform === 'win32') {
        const cmdShim = [
          '@echo off',
          'setlocal DisableDelayedExpansion',
          `if defined ${sentinel} goto :real`,
          `set "${sentinel}=1"`,
          `${firewallWindowsPath(firewallPath)} ${firewallWindowsPath(realPath)} %*`,
          'exit /b %errorlevel%',
          ':real',
          `${firewallWindowsPath(realPath)} %*`,
          'exit /b %errorlevel%',
        ].join('\r\n')

        await fs.writeFile(
          path.join(shimDir, `${command}.cmd`),
          `${cmdShim}\r\n`,
        )
      }

      shimmed.push(command)
    }
  } finally {
    if (runnerPath === undefined) {
      delete process.env.PATH
    } else {
      process.env.PATH = runnerPath
    }
  }

  // PATH is searched left to right, so the shims have to land ahead of the
  // real binaries.
  addPath(shimDir)
  if (runnerPath === undefined) {
    process.env.PATH = shimDir
  }
  saveState(FIREWALL_SHIM_STATE_KEY, { commands, directory: shimDir })

  // Later steps read SFW_SHIM_DIR to disable the shims for a publish flow.
  exportVariable('SFW_SHIM_DIR', shimDir)

  info(`created shims for: ${shimmed.join(', ')}`)
}

export function firewallCommandPath(filename) {
  const normalized = normalizePath(path.resolve(fromUnixPath(filename)))
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

/**
 * Package manager commands the given edition can front, a fresh list each call
 * so one caller cannot mutate the next caller's set. The free edition covers
 * the npm, Python, and Rust ecosystems; enterprise adds Ruby and .NET
 * everywhere, and Go on Linux.
 *
 * @param {string} edition Edition installed, `free` or `enterprise`.
 *
 * @returns {string[]} Command names to write a shim for.
 */
export function firewallShimCommands(edition) {
  const commands = ['cargo', 'npm', 'pip', 'pip3', 'pnpm', 'uv', 'yarn']
  if (edition !== 'enterprise') {
    return commands
  }
  commands.push('bundler', 'gem', 'nuget')
  if (process.platform === 'linux') {
    commands.push('go')
  }
  return commands
}

export function firewallWindowsPath(filename) {
  return `"${filename.replace(/%/g, '%%')}"`
}

export function invalidFirewallShimState() {
  return Object.assign(
    new Error(
      'Cannot validate firewall command precedence: saved action state is invalid. Expected a shim directory and command list. Run the firewall action again.',
    ),
    { code: 'SFW_SHIM_STATE_INVALID' },
  )
}

export function parseFirewallShimState(saved) {
  let state
  try {
    state = JSON.parse(saved)
  } catch {
    throw invalidFirewallShimState()
  }
  if (
    !state ||
    typeof state !== 'object' ||
    typeof state.directory !== 'string' ||
    !path.isAbsolute(state.directory) ||
    !Array.isArray(state.commands) ||
    state.commands.length === 0 ||
    !state.commands.every(
      command =>
        typeof command === 'string' && /^[a-z][a-z0-9]*$/.test(command),
    )
  ) {
    throw invalidFirewallShimState()
  }
  return state
}
