import { inspect } from 'node:util'

import {
  debug,
  exportVariable,
  getBooleanInput,
  getInput,
  setFailed,
  setSecret,
} from '@actions/core'

import { downloadFirewall } from './tools/firewall.js'
import { applyPatches } from './tools/patch.js'

/**
 * Error handler.
 *
 * @param {object} error Thrown error or unhandled rejection.
 */
export function errorHandler(error) {
  setFailed(`${error.message}`)
  debug(inspect(error))
  process.exit(1)
}

// catch errors and exit
process.on('unhandledRejection', errorHandler)
process.on('uncaughtException', errorHandler)

/**
 * Install the tool the `mode` input names, then run it.
 */
export async function main() {
  const inputs = {
    jobSummary: getInput('job-summary', { required: false }).toLowerCase(),
    mode: getInput('mode', { required: true }).toLowerCase(),
    patchCwd: getInput('patch-cwd'),
    patchDryRun: getBooleanInput('patch-dry-run'),
    patchEcosystems: getInput('patch-ecosystems'),
    tokenGithub: getInput('github-token', { required: true }),
    tokenSocket: getInput('socket-token'),
    useCache: getBooleanInput('use-cache'),
    versionFirewall: getInput('firewall-version'),
    versionPatch: getInput('patch-version'),
  }

  // backward compatibility
  if (inputs.jobSummary === 'true') {
    inputs.jobSummary = 'all'
  }
  if (inputs.jobSummary === 'false') {
    inputs.jobSummary = 'none'
  }

  if (inputs.tokenSocket) {
    // setup socket token as a secret env. Both names are exported: the
    // canonical SOCKET_API_TOKEN and the legacy SOCKET_API_KEY that older sfw
    // builds still read, so pinning an older firewall version keeps working.
    // oxlint-disable-next-line socket/socket-api-token-env -- the legacy alias is exported ON PURPOSE, beside the canonical name, for older sfw binaries.
    exportVariable('SOCKET_API_KEY', inputs.tokenSocket)
    exportVariable('SOCKET_API_TOKEN', inputs.tokenSocket)
    setSecret(inputs.tokenSocket)
  }

  debug(`Installing Socket Action in ${inputs.mode} mode`)

  switch (inputs.mode) {
    case 'firewall': {
      const edition = inputs.tokenSocket ? 'enterprise' : 'free'
      await downloadFirewall({ edition, ...inputs })
      break
    }

    case 'firewall-free': {
      await downloadFirewall({ edition: 'free', ...inputs })
      break
    }

    case 'firewall-enterprise': {
      await downloadFirewall({ edition: 'enterprise', ...inputs })
      break
    }

    case 'patch': {
      await applyPatches(inputs)
      break
    }

    default: {
      throw new Error(
        `Unsupported mode: ${inputs.mode}. Supported modes: firewall, patch, cli`,
      )
    }
  }
}

main().catch(errorHandler)
