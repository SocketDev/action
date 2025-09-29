import { inspect } from 'node:util'
import core from '@actions/core'
import firewall from './tools/firewall.js'

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
  mode: core.getInput('mode', { required: true }).toLowerCase(),
  tokenGithub: core.getInput('github-token', { required: true }),
  tokenSocket: core.getInput('socket-token'),
  versionFirewall: core.getInput('firewall-version'),
  useCache: core.getBooleanInput('use-cache'),
  jobSummary: core.getBooleanInput('job-summary')
}

let edition = 'free'

if (inputs.tokenSocket) {
  // setup socket token as a secret env
  core.exportVariable('SOCKET_API_KEY', inputs.tokenSocket)
  core.setSecret(inputs.tokenSocket)

  // use Enterprise Firewall
  edition = 'enterprise'
}

core.debug(`Installing Socket Action in ${inputs.mode} mode`)

switch (inputs.mode) {
  case 'firewall': {
    await firewall({ edition, ...inputs })
    break
  }

  // TODO
  // case 'cli': {
  //   await cli()
  //   break
  // }

  default: {
    throw new Error(`Unsupported mode: ${inputs.mode}. Supported modes: firewall, cli`)
  }
}
