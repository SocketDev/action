import path from 'node:path'

import { getState } from '@actions/core'
import { which } from '@actions/io'

import {
  FIREWALL_SHIM_STATE_KEY,
  firewallCommandPath,
  parseFirewallShimState,
} from './firewall-shims.js'

/**
 * @typedef {{
 *   command: string
 *   status: 'selected' | 'missing' | 'shadowed' | 'unavailable'
 * }} FirewallShimDiagnostic
 */

/**
 * Report which saved firewall shims resolve first in the current job PATH.
 *
 * @returns {Promise<FirewallShimDiagnostic[]>}
 */
export async function diagnoseFirewallShims() {
  const saved = getState(FIREWALL_SHIM_STATE_KEY)
  if (!saved) {
    return []
  }

  const state = parseFirewallShimState(saved)

  const expectedDirectory = firewallCommandPath(state.directory)
  const diagnostics = []
  const commands = state.completedCommands ?? state.commands
  for (const command of commands) {
    let executable
    try {
      executable = await which(command, false)
    } catch {
      diagnostics.push({ command, status: 'unavailable' })
      continue
    }
    if (!executable) {
      diagnostics.push({ command, status: 'missing' })
      continue
    }

    const actualDirectory = firewallCommandPath(path.dirname(executable))
    diagnostics.push({
      command,
      status: actualDirectory === expectedDirectory ? 'selected' : 'shadowed',
    })
  }
  return diagnostics
}
