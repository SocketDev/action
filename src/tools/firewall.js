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
export const FIREWALL_VERSION = 'v1.15.2'

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
      '7fea0f5dcf14a158f009ab2906eeed853e624965390d914fa733f03d7f4780d0',
    'darwin-x64':
      '53691eba2c1b9098c3c1be07bd2fc73662bcf21be31f829822a29ae2b06a520a',
    'linux-arm64':
      'dacd379481777f7afada49f18f76a6beaf1323ca007e48d2bb8aac790ff058d9',
    'linux-x64':
      '48dad19367ca076ffdad0b3d1b9df7bd1c381ae9b222b2fe5e132d690d660288',
    'win32-arm64':
      'a6d843238d048ffadbb00621f37ee1de9ba5964140b2f9392a14d5dce4d70966',
    'win32-x64':
      '6d4ae4a450b2c596e8db08ab06215dedc6daa6d40e5ebc235b1c1b6a72080bae',
  },
  free: {
    'darwin-arm64':
      '28c4d14ed5db09e3a3e299c02036ddaa524c5c476cb28e32deac4f77091acacb',
    'darwin-x64':
      '3abd6086098e6ad604a8814cd6a5d9e5dd8e64c2108583f9e85c12e08baa7a26',
    'linux-arm64':
      'd3e5490e7a1315ff2ba9bcc903d9d57de042d8dcde83dde1d59536725a470946',
    'linux-x64':
      'fea8171808f9d913635c8f55fa70f7e72451cd38b0fca3d694e12ee1a9d7fc68',
    'win32-arm64':
      'd762eb85db7b39f0d14f3724514e1eb45f86955b6bc7a9978bc82917549bf4eb',
    'win32-x64':
      '8802ace1584212ed0361db6f4f12447f9f426b52c24eada54f7625910c3d5292',
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
export const FIREWALL_MIRROR_BASE_URL = 'https://install.socket.dev/firewall/dl'

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

  // construct the download urls
  const urls = firewallDownloadUrls(
    edition,
    repo,
    versionToDownload,
    nameDownload,
  )

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
 * `downloadTool` with attempts layered on top of its own, alternating between
 * equivalent origins. Retryable failures spend the delay table; an error that
 * a retry cannot change (a 404) still gets one immediate try per remaining
 * origin, because a missing asset on one host says nothing about the others.
 * The last error is rethrown untouched so the caller still reports the real
 * cause.
 *
 * @param {string[]} urls Equivalent origins for the same asset, in the order
 *   to try them.
 *
 * @returns {Promise<string>} Path the asset was downloaded to.
 */
export async function downloadToolWithRetry(urls) {
  let lastError

  for (
    let attempt = 0;
    attempt <= DOWNLOAD_RETRY_DELAYS_SECONDS.length;
    attempt += 1
  ) {
    const url = urls[attempt % urls.length]

    try {
      return await downloadTool(url)
    } catch (error) {
      lastError = error

      const seconds = DOWNLOAD_RETRY_DELAYS_SECONDS[attempt]

      if (seconds === undefined) {
        break
      }

      if (isRetryableDownloadError(error)) {
        warning(
          `Socket Firewall binary download from ${url} failed (attempt ${attempt + 1} of ${DOWNLOAD_RETRY_DELAYS_SECONDS.length + 1}): ${errorMessage(error)}. Retrying in ${seconds}s.`,
        )
        await setTimeout(seconds * 1000)
      } else if (attempt < urls.length - 1) {
        warning(
          `Socket Firewall binary download from ${url} failed: ${errorMessage(error)}. Trying ${urls[(attempt + 1) % urls.length]}.`,
        )
      } else {
        break
      }
    }
  }

  throw lastError
}

/**
 * Origins to download one release asset from, in the order to try them. The
 * free edition is also mirrored on Socket-owned infrastructure, and one of the
 * two origins is picked at random per job: half the fleet's downloads keep the
 * mirror's edge cache warm, which is what lets it keep serving during a GitHub
 * release-asset incident. The enterprise repository is private and not
 * mirrored, so it stays GitHub-only.
 *
 * @param {string} edition Firewall edition being installed.
 * @param {string} repo GitHub repository the release lives in.
 * @param {string} version Release tag to download.
 * @param {string} asset Release asset name.
 * @param {() => number} random Injectable for tests.
 *
 * @returns {string[]} Download URLs, primary origin first.
 */
export function firewallDownloadUrls(
  edition,
  repo,
  version,
  asset,
  random = Math.random,
) {
  const urls = [
    `https://github.com/SocketDev/${repo}/releases/download/${version}/${asset}`,
  ]

  if (edition === 'free') {
    urls.push(`${FIREWALL_MIRROR_BASE_URL}/${version}/${asset}`)
    if (random() < 0.5) {
      urls.reverse()
    }
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
