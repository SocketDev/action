import crypto from 'node:crypto'
import path from 'node:path'

import { addPath, debug, exportVariable, info, setOutput } from '@actions/core'
import { exec } from '@actions/exec'
import { getOctokit } from '@actions/github'
import { cacheFile, downloadTool, find } from '@actions/tool-cache'

import { errorMessage } from '@socketsecurity/lib/errors/message'

/**
 * `<platform>-<arch>` (Node's own spelling) to the suffix of the release asset
 * that carries that build. A key missing here is a platform the firewall does
 * not publish a binary for, and the action fails fast rather than downloading
 * a 404.
 */
export const FIREWALL_DISTRIBUTIONS = {
  'darwin-arm64': 'macos-arm64',
  'darwin-x64': 'macos-x86_64',
  'linux-arm64': 'linux-arm64',
  'linux-x64': 'linux-x86_64',
  'win32-arm64': 'windows-arm64.exe',
  'win32-x64': 'windows-x86_64.exe',
}

/**
 * Name the firewall binary is cached and executed under.
 */
export const FIREWALL_EXEC_NAME = 'sfw'

/**
 * Downloads firewall binary if not in cache, and adds to exec path.
 *
 * @param {object} inputs Action inputs, including the `edition` to install.
 */
export async function downloadFirewall({ edition = 'free', ...inputs }) {
  const distributionKey = `${process.platform}-${process.arch}`
  const distribution = FIREWALL_DISTRIBUTIONS[distributionKey]

  // exit early
  if (!distribution) {
    throw new Error(`Unsupported architecture ${distributionKey}`)
  }

  // free edition?
  const repo = edition === 'free' ? 'sfw-free' : 'firewall-release'

  // octokit client
  const octokit = getOctokit(inputs.tokenGithub, {
    userAgent: 'Socket-GitHub-Action',
  })

  // check github releases for matching version
  let response

  try {
    const method =
      inputs.versionFirewall === 'latest'
        ? 'getLatestRelease'
        : 'getReleaseByTag'
    response = await octokit.rest.repos[method]({
      tag: inputs.versionFirewall ? `v${inputs.versionFirewall}` : undefined,
      owner: 'socketdev',
      repo,
    })
  } catch (error) {
    debug(`[${error?.status}] ${error?.response?.url} ${errorMessage(error)}`)
    throw new Error(`failed to check version ${inputs.versionFirewall}`)
  }

  // use the tag_name as the version to download
  const { tag_name: versionToDownload } = response.data

  // construct the binary name
  let nameDownload = 'sfw'

  // free edition?
  if (edition === 'free') {
    nameDownload += '-free'
  }

  // add distribution
  nameDownload += `-${distribution}`

  // cache options
  const cacheOptions = [
    `socket-firewall-${edition}`,
    versionToDownload,
    process.arch,
  ]

  // construct the download url
  const url = `https://github.com/SocketDev/${repo}/releases/download/${versionToDownload}/${nameDownload}`

  let pathCache

  // find previous cache entry
  if (inputs.useCache) {
    pathCache = find(...cacheOptions)
  }

  // no cache, download new
  if (!pathCache) {
    debug(`downloading Socket Firewall binary from: ${url}`)

    try {
      // download it
      const pathDownload = await downloadTool(url)

      // cache it
      pathCache = await cacheFile(
        pathDownload,
        FIREWALL_EXEC_NAME,
        ...cacheOptions,
      )
    } catch (error) {
      throw new Error(
        `Failed to download Socket Firewall binary: ${errorMessage(error)}`,
      )
    }
  }

  const pathBinary = path.join(pathCache, FIREWALL_EXEC_NAME)

  // make executable on Unix systems
  if (process.platform !== 'win32') {
    await exec('chmod', ['+x', pathBinary])
  }

  // send to outputs
  setOutput('firewall-path-binary', pathBinary)

  // Add to $PATH
  addPath(pathCache)

  info(
    `Socket Firewall ${edition} edition installed, requested: ${inputs.versionFirewall}, resolved: ${versionToDownload}`,
  )

  debug(`binary location: ${pathCache}`)

  // set report path env
  if (inputs.jobSummary !== 'none') {
    const pathReport = `${path.join(process.env.RUNNER_TEMP, crypto.randomUUID())}.json`
    // set the env info to be used in "post.js" step
    exportVariable('SFW_JSON_REPORT_PATH', pathReport)

    // send to outputs
    setOutput('firewall-path-report', pathReport)

    debug(`report path set to : ${pathReport}`)
  }
}
