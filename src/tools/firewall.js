import crypto from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
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
export const FIREWALL_VERSION = 'v1.15.4'

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
      'b243b85e68435d2fb5a9419a037bfbc70f37e9ea5ca5a6690276843779331772',
    'darwin-x64':
      '4b3e686afca92029afe3d0d477c2755e0b50bcb9c3bb3c2df178940be380ca50',
    'linux-arm64':
      'f044a48abfaf546b4d0877602043a905418daf7063e79fb8087760bba4d13c5e',
    'linux-x64':
      'bcb8e0f0debec245a0cff6fed01ab2cb2c37c0d03a0be6c0b39164d60dd3a291',
    'win32-arm64':
      '6804c7972da28638ad7abda9378c1cf59ba6e10d1c04294560de9c46c0b5d733',
    'win32-x64':
      'a6b8b8909a95d92bf83521a6dce418d4c44189ff977854ef1fa1767361654a0b',
  },
  free: {
    'darwin-arm64':
      '1b705ea7c399727ee41aa93f63e0469d2c3787c50e1dd8842cb8ff5ceec9eb99',
    'darwin-x64':
      'b19f96f0dd3ebc4ecc7111dbc43cc2b095f37bf759273c0bd9c0c4784ea24731',
    'linux-arm64':
      'c8c80aa582829f24f5d633f2c3f2ccd0b070bbee80bf3b956e5e2a9880184e20',
    'linux-x64':
      'cf9f55b8343e1ef6e6dcccdb09b99c70c0430a22ed7d0079286eccddeaf72670',
    'win32-arm64':
      '16607f9c64055b8e0af918dc93a72a342ca8352f46e6e3f810d1a378a380a82a',
    'win32-x64':
      'f8c94fc5e41d49c51d2fd013c2c169274df9c483fc763d8c82ff71c5579d3bb0',
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
 * File name the binary is cached under. Windows gets the `.exe` suffix: the
 * `.cmd` shims run the binary through cmd.exe, which does not execute a
 * suffix-less file, and neither does PowerShell. Bash on a Windows runner
 * does, which is why `sfw npm install` typed in a workflow worked while every
 * shimmed `npm install`, and every `sfw` call that reached a shim, failed.
 */
export const FIREWALL_EXEC_FILE =
  process.platform === 'win32'
    ? `${FIREWALL_EXEC_NAME}.exe`
    : FIREWALL_EXEC_NAME

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
    pathCache = findCachedFirewall(cacheOptions)
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
        FIREWALL_EXEC_FILE,
        ...cacheOptions,
      )
    } catch (error) {
      throw new Error(
        `Failed to cache Socket Firewall binary: ${errorMessage(error)}`,
      )
    }
  }

  const pathBinary = path.join(pathCache, FIREWALL_EXEC_FILE)

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
 * Directory an earlier job cached the binary in, or undefined when there is
 * none this version can use. `find` only checks that the version directory
 * and its `.complete` marker exist. Action versions before this one cached the
 * Windows binary as `sfw`, without the suffix the shims need, so a runner that
 * keeps its tool cache can hold an entry that lacks the file this version
 * runs. That entry counts as a miss and the fresh download replaces it.
 *
 * @param {string[]} cacheOptions Tool name, version and arch, as passed to
 *   `find` and `cacheFile`.
 *
 * @returns {string | undefined} Cache directory holding
 *   `FIREWALL_EXEC_FILE`, if there is one.
 */
export function findCachedFirewall(cacheOptions) {
  const pathCache = find(...cacheOptions)

  if (!pathCache) {
    return undefined
  }

  if (!existsSync(path.join(pathCache, FIREWALL_EXEC_FILE))) {
    debug(
      `cache entry ${pathCache} has no ${FIREWALL_EXEC_FILE}, downloading again`,
    )
    return undefined
  }

  return pathCache
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
  hash.update(await readFile(filePath))
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
