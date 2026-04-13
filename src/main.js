import { inspect } from 'node:util'
import core from '@actions/core'
import firewall from './tools/firewall.js'
import patch from './tools/patch.js'

/**
 * error handler
 * @param {object} error thrown error or unhandled rejection
 */
function errorHandler (error) {
  core.setFailed(`${error.message}`)
  core.debug(inspect(error))
  process.exit(1)
}

// catch errors and exit
process.on('unhandledRejection', errorHandler)
process.on('uncaughtException', errorHandler)

const inputs = {
  jobSummary: core.getInput('job-summary', { required: false }).toLowerCase(),
  mode: core.getInput('mode', { required: true }).toLowerCase(),
  patchCwd: core.getInput('patch-cwd'),
  patchDryRun: core.getBooleanInput('patch-dry-run'),
  patchEcosystems: core.getInput('patch-ecosystems'),
  shims: core.getBooleanInput('shims'),
  tokenGithub: core.getInput('github-token', { required: true }),
  tokenSocket: core.getInput('socket-token'),
  useCache: core.getBooleanInput('use-cache'),
  versionFirewall: core.getInput('firewall-version'),
  versionPatch: core.getInput('patch-version')
}

// backward compatibility
if (inputs.jobSummary === 'true') inputs.jobSummary = 'all'
if (inputs.jobSummary === 'false') inputs.jobSummary = 'none'

if (inputs.tokenSocket) {
  // setup socket token as a secret env so sfw can use it
  core.exportVariable('SOCKET_API_KEY', inputs.tokenSocket)
  core.exportVariable('SOCKET_API_TOKEN', inputs.tokenSocket)
  core.setSecret(inputs.tokenSocket)
}

core.debug(`Installing Socket Action in ${inputs.mode} mode`)

switch (inputs.mode) {
  case 'firewall': {
    const edition = inputs.tokenSocket ? 'enterprise' : 'free'
    await firewall({ edition, ...inputs })
    break
  }

  case 'firewall-free': {
    await firewall({ edition: 'free', ...inputs })
    break
  }

  case 'firewall-enterprise': {
    await firewall({ edition: 'enterprise', ...inputs })
    break
  }

  case 'patch': {
    await patch(inputs)
    break
  }

  // TODO
  // case 'cli': {
  //   await cli()
  //   break
  // }

  default: {
    throw new Error(`Unsupported mode: ${inputs.mode}. Supported modes: firewall, patch, cli`)
  }
}
