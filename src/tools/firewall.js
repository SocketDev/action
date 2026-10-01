import crypto from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { setTimeout } from 'node:timers/promises'

import {
  addPath,
  debug,
  exportVariable,
  info,
  setOutput,
  warning,
} from '@actions/core'
import { exec } from '@actions/exec'
import { cacheFile, downloadTool, find } from '@actions/tool-cache'

import { errorMessage } from '@socketsecurity/lib/errors/message'
import { createFirewallShims } from './firewall-shims.js'

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
 * Release tag every checksum below was taken from, and the version the action
 * installs when `firewall-version` is left at its default.
 */
export const FIREWALL_VERSION = 'v1.15.3'

/**
 * SHA256 of each `FIREWALL_VERSION` asset, per edition and per
 * `<platform>-<arch>`. The hashes are pinned in source rather than read from a
 * `.sha256` file beside the download: a checksum served by whoever served the
 * binary proves nothing about it. A build with no entry here cannot be
 * verified, so the action refuses it instead of installing it unchecked.
 */
export const FIREWALL_CHECKSUMS = {
  enterprise: {
    'darwin-arm64':
      'dee9d3179ce1cc6e8cf469c1e446af02ba7a47172cf13220b1808bbd7a524605',
    'darwin-x64':
      '873bf3ad2bdd012793a9801860fd3a26a5536353b783f6bce7b807002e3c7789',
    'linux-arm64':
      'aba4f4fba0d6775496f10c383d290518db1984bba5cf4378540878ac08752973',
    'linux-x64':
      '165aab86a749d3a249c5572ff693548017f98c6ee8a8df51f41804c542decf70',
    'win32-arm64':
      '261d58f5caa8d4afd1e7a5159249d28b73bcd817f7ed6ffb812d0b1cf7258fe1',
    'win32-x64':
      'cbbd2a50e3ced2ec1f32491542d979ec0e906142c3e13f0be7aa6355b6bd0388',
  },
  free: {
    'darwin-arm64':
      '284e68467dc017ac6a8c17bdfd6e883cdf6b3195d14c263610a2eb03ae1bfdc0',
    'darwin-x64':
      'c68d15da47b870f557e148669e009e5ba0af386c4df6ec1ad88be05a418d207e',
    'linux-arm64':
      'd10a203a91aea18d527e24f32f9164e9d322c96ca57749e2ab535fa3791b0455',
    'linux-x64':
      '2aca7b45150bebd7343e977fb82f387ffe143f5bc03e557741daeb51f5ee27b4',
    'win32-arm64':
      '521d1021ac82562978dc871f47d584c8f4c41c71c6c5e456ef6389429fef5457',
    'win32-x64':
      'f097b51e8ffb3d4d5313d84a371b20f18e4e2f830cc44b71165468161d9affc2',
  },
}

/**
 * Seconds to wait before each retry, indexed by the attempt that just failed;
 * one more attempt is made than there are entries here. `downloadTool` retries
 * three times of its own accord, 10 to 20 seconds apart. That budget is
 * roughly 40 seconds against a single origin, and a GitHub release-asset 504
 * routinely outlives it, failing the whole job over a blip a human fixes by
 * pressing re-run. These delays stretch the total window past a minute without
 * stalling a job for long when the outage is not transient.
 */
export const DOWNLOAD_RETRY_DELAYS_SECONDS = [30, 60]

/**
 * Socket-owned mirror of the sfw-free release binaries, relayed by
 * firewall-download-server in depscan. Free edition only: the enterprise
 * repository is private and not mirrored.
 */
export const FIREWALL_FREE_MIRROR_BASE_URL =
  'https://install.socket.dev/firewall/dl'

/**
 * Name the firewall binary is cached and executed under.
 */
export const FIREWALL_EXEC_NAME = 'sfw'

/**
 * Downloads firewall binary if not in cache, checks it against the hash pinned
 * for its release, and adds to exec path. Package manager shims are written
 * too unless the `shims` input turns them off.
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

  const editionChecksums = FIREWALL_CHECKSUMS[edition]

  if (!editionChecksums) {
    throw new Error(`Unknown edition ${edition}`)
  }

  const expectedHash = editionChecksums[distributionKey]

  // No pinned hash means the download cannot be verified, so it is refused
  // rather than installed unchecked.
  if (!expectedHash) {
    throw new Error(
      `No pinned checksum for the ${edition} edition on ${distributionKey} at ${FIREWALL_VERSION}`,
    )
  }

  // free edition?
  const repo = edition === 'free' ? 'sfw-free' : 'firewall-release'

  const versionToDownload = firewallReleaseVersion(inputs.versionFirewall)

  // construct the binary name
  let nameDownload = FIREWALL_EXEC_NAME

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

  // construct the download urls, tried in a random order per job: half the
  // fleet's downloads keep the mirror's edge cache warm, which is what lets it
  // keep serving during a GitHub release-asset incident.
  const origins = firewallDownloadUrls(
    edition,
    repo,
    versionToDownload,
    nameDownload,
  )
  const urls = shuffledIndexes(origins.length).map(i => origins[i])

  let pathCache

  // find previous cache entry
  if (inputs.useCache) {
    pathCache = find(...cacheOptions)
  }

  // no cache, download new
  if (!pathCache) {
    debug(`downloading Socket Firewall binary from: ${urls.join(', ')}`)

    let pathDownload

    try {
      // download it
      pathDownload = await downloadToolWithRetry(urls)
    } catch (error) {
      throw new Error(
        `Failed to download Socket Firewall binary: ${errorMessage(error)}`,
      )
    }

    // A mismatch throws here, before the binary is cached, made executable, or
    // put on PATH.
    await validateChecksum(pathDownload, expectedHash)

    try {
      // cache it
      pathCache = await cacheFile(
        pathDownload,
        FIREWALL_EXEC_NAME,
        ...cacheOptions,
      )
    } catch (error) {
      throw new Error(
        `Failed to cache Socket Firewall binary: ${errorMessage(error)}`,
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

  // route package manager commands through sfw without an explicit prefix
  if (inputs.shims) {
    await createFirewallShims(pathBinary, edition)
  }

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

/**
 * `downloadTool` with attempts layered on top of its own, across equivalent
 * origins. Every origin gets the whole delay table to itself: a round tries
 * each origin still in play, and a round that leaves none of them succeeding
 * sits out the next delay before going again. An origin that fails with an
 * error a retry cannot change (a 404) drops out of later rounds, so a mirror
 * that lacks the asset cannot use up the retries GitHub needs to ride out a
 * 504. The error rethrown is the last transient one when there was one, since
 * that is the outage worth reporting; otherwise the last error seen.
 *
 * @param {string[]} urls Equivalent origins for the same asset, in the order
 *   to try them.
 *
 * @returns {Promise<string>} Path the asset was downloaded to.
 */
export async function downloadToolWithRetry(urls) {
  let alive = urls
  let lastError
  let lastRetryableError

  for (let round = 0; ; round += 1) {
    const stillAlive = []

    for (const url of alive) {
      try {
        return await downloadTool(url)
      } catch (error) {
        lastError = error

        if (isRetryableDownloadError(error)) {
          lastRetryableError = error
          stillAlive.push(url)
          warning(
            `Socket Firewall binary download from ${url} failed (attempt ${round + 1} of ${DOWNLOAD_RETRY_DELAYS_SECONDS.length + 1}): ${errorMessage(error)}.`,
          )
        } else {
          warning(
            `Socket Firewall binary download from ${url} failed: ${errorMessage(error)}. Not retrying this origin.`,
          )
        }
      }
    }

    const seconds = DOWNLOAD_RETRY_DELAYS_SECONDS[round]

    if (stillAlive.length === 0 || seconds === undefined) {
      throw lastRetryableError ?? lastError
    }

    warning(`Retrying ${stillAlive.join(', ')} in ${seconds}s.`)
    await setTimeout(seconds * 1000)
    alive = stillAlive
  }
}

/**
 * Equivalent origins to download one release asset from. GitHub release
 * assets come first; the free edition is also mirrored on Socket-owned
 * infrastructure. The enterprise repository is private and not mirrored, so it
 * stays GitHub-only. Callers decide the order to try them in.
 *
 * @param {string} edition Firewall edition being installed.
 * @param {string} repo GitHub repository the release lives in.
 * @param {string} version Release tag to download.
 * @param {string} asset Release asset name.
 *
 * @returns {string[]} Download URLs, GitHub first.
 */
export function firewallDownloadUrls(edition, repo, version, asset) {
  const urls = [
    `https://github.com/SocketDev/${repo}/releases/download/${version}/${asset}`,
  ]

  if (edition === 'free') {
    urls.push(`${FIREWALL_FREE_MIRROR_BASE_URL}/${version}/${asset}`)
  }

  return urls
}

export function firewallReleaseVersion(requestedVersion) {
  let versionToDownload = FIREWALL_VERSION

  // The pinned hashes describe FIREWALL_VERSION alone, so any other version is
  // a binary this table cannot vouch for.
  if (requestedVersion && requestedVersion !== 'latest') {
    versionToDownload = `v${requestedVersion}`
    warning(
      `Requested firewall version ${versionToDownload}, but the checksum is pinned to ${FIREWALL_VERSION}. Validation fails if the binary differs.`,
    )
  }

  return versionToDownload
}

/**
 * SHA256 of a file on disk.
 *
 * @param {string} filePath File to hash.
 *
 * @returns {Promise<string>} Hex-encoded digest.
 */
export async function getFileChecksum(filePath) {
  const hash = crypto.createHash('sha256')
  hash.update(await fs.readFile(filePath))
  return hash.digest('hex')
}

/**
 * Whether a failed download is worth another attempt. A 4xx says the asset is
 * not there to be had, so retrying only burns job time. 408 and 429 are the
 * exceptions: a 408 means the server gave up waiting on this one request, not
 * that the asset is missing, and a 429 is rate limiting that clears once the
 * retry delay has been sat out. Anything without a status (socket hang-up,
 * DNS, timeout) is treated as transient.
 *
 * @param {unknown} error Error thrown by `downloadTool`.
 *
 * @returns {boolean} True when the download should be attempted again.
 */
export function isRetryableDownloadError(error) {
  const status = error?.httpStatusCode

  if (typeof status !== 'number') {
    return true
  }

  return status >= 500 || status === 408 || status === 429
}

/**
 * A random permutation of `0 .. length - 1` (Fisher-Yates), for callers that
 * need to try equivalent options in an unbiased order.
 *
 * @param {number} length How many indexes to permute.
 * @param {() => number} random Injectable for tests.
 *
 * @returns {number[]} Every index once, in random order.
 */
export function shuffledIndexes(length, random = Math.random) {
  const order = Array.from({ length }, (_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const swap = order[i]
    order[i] = order[j]
    order[j] = swap
  }
  return order
}

/**
 * Compare a downloaded binary against the hash pinned for its release and
 * throw when they differ. Both hashes are printed so an operator can tell a
 * stale pin apart from a tampered download.
 *
 * @param {string} binaryPath Binary that was just downloaded.
 * @param {string} expectedHash Hex-encoded SHA256 the release is pinned to.
 */
export async function validateChecksum(binaryPath, expectedHash) {
  info('validating checksum of downloaded binary')

  const actualHash = await getFileChecksum(binaryPath)

  debug(`expected checksum: ${expectedHash}`)
  debug(`actual checksum:   ${actualHash}`)

  if (actualHash !== expectedHash) {
    throw new Error(
      `Checksum mismatch, the binary may have been tampered with.\nExpected: ${expectedHash}\nGot:      ${actualHash}`,
    )
  }

  info('checksum validation passed')
}
