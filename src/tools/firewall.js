import core from '@actions/core'
import exec from '@actions/exec'
import github from '@actions/github'
import io from '@actions/io'
import tool from '@actions/tool-cache'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'

// supported distributions map
const distributions = {
  'linux-x64': 'linux-x86_64',
  'linux-arm64': 'linux-arm64',
  'darwin-x64': 'macos-x86_64',
  'darwin-arm64': 'macos-arm64',
  'win32-x64': 'windows-x86_64.exe'
}

// executable name
const nameExec = 'sfw'

/**
 * downloads firewall binary if not in cache, and adds to exec path
 * @param {boolean} useCache flag to use or bypass cache
 */
export default async function download ({ edition = 'free', ...inputs }) {
  const distributionKey = `${process.platform}-${process.arch}`
  const distribution = distributions[distributionKey]

  // exit early
  if (!distribution) {
    throw new Error(`Unsupported architecture ${distributionKey}`)
  }

  // free edition?
  const repo = edition === 'free' ? 'sfw-free' : 'firewall-release'

  // octokit client
  const octokit = github.getOctokit(inputs.tokenGithub, { userAgent: 'Socket-GitHub-Action' })

  // check github releases for matching version
  let response

  try {
    const method = inputs.versionFirewall === 'latest' ? 'getLatestRelease' : 'getReleaseByTag'
    response = await octokit.rest.repos[method]({
      tag: inputs.versionFirewall ? `v${inputs.versionFirewall}` : undefined,
      owner: 'socketdev',
      repo
    })
  } catch (error) {
    core.debug(`[${error?.status}] ${error?.response.url} ${error.message}`)
    throw new Error(`failed to check version ${inputs.versionFirewall}`)
  }

  // use the tag_name as the version to download
  const { tag_name: versionToDownload } = response.data

  // construct the binary name
  let nameDownload = 'sfw'

  // free edition?
  if (edition === 'free') nameDownload += '-free'

  // add distribution
  nameDownload += `-${distribution}`

  // cache options
  const cacheOptions = [`socket-firewall-${edition}`, versionToDownload, process.arch]

  // construct the download url
  const url = `https://github.com/SocketDev/${repo}/releases/download/${versionToDownload}/${nameDownload}`

  let pathCache

  // find previous cache entry
  if (inputs.useCache) {
    pathCache = tool.find(...cacheOptions)
  }

  // no cache, download new
  if (!pathCache) {
    core.debug(`downloading Socket Firewall binary from: ${url}`)

    try {
      // download it
      const pathDownload = await tool.downloadTool(url)

      // cache it
      pathCache = await tool.cacheFile(pathDownload, nameExec, ...cacheOptions)
    } catch (error) {
      throw new Error(`Failed to download Socket Firewall binary: ${error}`)
    }
  }

  const pathBinary = path.join(pathCache, nameExec)

  // make executable on Unix systems
  if (process.platform !== 'win32') {
    await exec.exec('chmod', ['+x', pathBinary])
  }

  // send to outputs
  core.setOutput('firewall-path-binary', pathBinary)

  // Add to $PATH
  core.addPath(pathCache)

  core.info(`Socket Firewall ${edition} edition installed, requested: ${inputs.versionFirewall}, resolved: ${versionToDownload}`)

  core.debug(`binary location: ${pathCache}`)

  // set report path env
  if (inputs.jobSummary) {
    const pathReport = `${path.join(process.env.RUNNER_TEMP, randomUUID())}.json`
    // set the env info to be used in "post.js" step
    core.exportVariable('SFW_JSON_REPORT_PATH', pathReport)

    // send to outputs
    core.setOutput('firewall-path-report', pathReport)

    core.debug(`report path set to : ${pathReport}`)
  }
}
