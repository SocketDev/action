/**
 * @file Minimal GitHub Actions tool-cache slice — the surface of
 *   `@actions/tool-cache` this action consumes (download to RUNNER_TEMP,
 *   cache into RUNNER_TOOL_CACHE, find a cached version), re-homed on node
 *   builtins + the local toolkit so the npm dependency (and its
 *   http-client/undici tree) stays out of the supply chain. Semantics mirror
 *   `@actions/tool-cache@2.0.2` for that surface: the
 *   `<cache>/<tool>/<version>/<arch>` + `.complete` marker layout,
 *   `v`-prefix version cleaning, and download retries. Extraction lives in
 *   `archive.js`; the runner directories in `runner-paths.js`. Only explicit
 *   versions are supported — the call sites always pass a resolved release
 *   tag, never a semver range.
 */

import crypto from 'node:crypto'
import {
  createWriteStream,
  existsSync,
  promises as fs,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { setTimeout as delay } from 'node:timers/promises'

import { errorMessage } from '@socketsecurity/lib/errors/message'
import { safeDelete } from '@socketsecurity/lib-stable/fs/safe'

import { extractTar, extractZip } from './archive.js'
import { core } from './core.js'
import { getCacheDirectory, getTempDirectory } from './runner-paths.js'

export { extractTar, extractZip } from './archive.js'

const USER_AGENT = 'actions/tool-cache'

// The `X.Y.Z[-prerelease][+build]` shape, allowing the loose `v`/`=` prefixes
// semver.clean() accepts.
const EXPLICIT_VERSION_PATTERN =
  /^[\s=v]*(\d+\.\d+\.\d+(?:-[\d.A-Za-z-]+)?(?:\+[\d.A-Za-z-]+)?)\s*$/

/**
 * Error thrown for a non-200 download response, carrying the status code so
 * retry logic can tell client errors from server errors.
 */
export class HTTPError extends Error {
  /**
   * @param {number | undefined} httpStatusCode - The response status code.
   */
  constructor(httpStatusCode) {
    super(`Unexpected HTTP response: ${httpStatusCode}`)
    this.httpStatusCode = httpStatusCode
  }
}

/**
 * Caches a directory into the tool cache.
 *
 * @param {string} sourceDir - Directory to cache into tools.
 * @param {string} tool - Tool name.
 * @param {string} version - Version of the tool, semver format.
 * @param {string} [arch] - Architecture; defaults to the machine's.
 *
 * @returns {Promise<string>} The cached directory path.
 */
export async function cacheDir(sourceDir, tool, version, arch) {
  const cleanVersion = semverClean(version) || version
  const archToUse = arch || os.arch()
  core.debug(`Caching tool ${tool} ${cleanVersion} ${archToUse}`)
  core.debug(`source dir: ${sourceDir}`)
  // oxlint-disable-next-line socket/prefer-exists-sync -- needs isDirectory()
  if (!statSync(sourceDir).isDirectory()) {
    throw new Error('sourceDir is not a directory')
  }
  const destPath = await createToolPath(tool, cleanVersion, archToUse)
  // Copy each child item. Do not move — a move can fail on Windows due to
  // anti-virus software holding an open handle on a file.
  const itemNames = readdirSync(sourceDir)
  for (let i = 0, { length } = itemNames; i < length; i += 1) {
    const itemName = itemNames[i]
    await fs.cp(path.join(sourceDir, itemName), path.join(destPath, itemName), {
      recursive: true,
    })
  }
  completeToolPath(tool, cleanVersion, archToUse)
  return destPath
}

/**
 * Caches a downloaded file (typically a downloadTool GUID path) into the
 * tool cache under a given target name.
 *
 * @param {string} sourceFile - File to cache into tools.
 * @param {string} targetFile - Name of the file in the tools directory.
 * @param {string} tool - Tool name.
 * @param {string} version - Version of the tool, semver format.
 * @param {string} [arch] - Architecture; defaults to the machine's.
 *
 * @returns {Promise<string>} The cached directory path.
 */
export async function cacheFile(sourceFile, targetFile, tool, version, arch) {
  const cleanVersion = semverClean(version) || version
  const archToUse = arch || os.arch()
  core.debug(`Caching tool ${tool} ${cleanVersion} ${archToUse}`)
  core.debug(`source file: ${sourceFile}`)
  // oxlint-disable-next-line socket/prefer-exists-sync -- needs isFile()
  if (!statSync(sourceFile).isFile()) {
    throw new Error('sourceFile is not a file')
  }
  const destFolder = await createToolPath(tool, cleanVersion, archToUse)
  const destPath = path.join(destFolder, targetFile)
  core.debug(`destination file ${destPath}`)
  // Copy instead of move, same Windows anti-virus rationale as cacheDir.
  await fs.copyFile(sourceFile, destPath)
  completeToolPath(tool, cleanVersion, archToUse)
  return destFolder
}

/**
 * Writes the `.complete` marker beside a tool's cache directory.
 *
 * @param {string} tool - Tool name.
 * @param {string} version - Cleaned version.
 * @param {string} arch - Architecture.
 */
export function completeToolPath(tool, version, arch) {
  const folderPath = path.join(getCacheDirectory(), tool, version, arch)
  writeFileSync(`${folderPath}.complete`, '')
  core.debug('finished caching tool')
}

/**
 * Creates (or recreates) a tool's cache directory, clearing any stale
 * contents and marker.
 *
 * @param {string} tool - Tool name.
 * @param {string} version - Cleaned version.
 * @param {string} arch - Architecture.
 *
 * @returns {Promise<string>} The created directory path.
 */
export async function createToolPath(tool, version, arch) {
  const folderPath = path.join(getCacheDirectory(), tool, version, arch)
  core.debug(`destination ${folderPath}`)
  await safeDelete(folderPath)
  await safeDelete(`${folderPath}.complete`)
  await fs.mkdir(folderPath, { recursive: true })
  return folderPath
}

/**
 * Downloads a tool from a url and streams it into a file, retrying transient
 * failures up to three times.
 *
 * @param {string} url - Url of the tool to download.
 * @param {string} [dest] - Path to download to; defaults to a GUID under
 *   RUNNER_TEMP.
 * @param {string} [auth] - Authorization header value.
 *
 * @returns {Promise<string>} Path to the downloaded tool.
 */
export async function downloadTool(url, dest, auth) {
  const destination = dest || path.join(getTempDirectory(), crypto.randomUUID())
  await fs.mkdir(path.dirname(destination), { recursive: true })
  core.debug(`Downloading ${url}`)
  core.debug(`Destination ${destination}`)
  const maxAttempts = 3
  const minSeconds = getGlobalOverride(
    'TEST_DOWNLOAD_TOOL_RETRY_MIN_SECONDS',
    10,
  )
  const maxSeconds = getGlobalOverride(
    'TEST_DOWNLOAD_TOOL_RETRY_MAX_SECONDS',
    20,
  )
  let attempt = 1
  for (;;) {
    try {
      return await downloadToolAttempt(url, destination, auth)
    } catch (e) {
      if (attempt >= maxAttempts || !isRetryableDownloadError(e)) {
        throw e
      }
      core.info(errorMessage(e))
      const seconds = Math.floor(
        minSeconds + Math.random() * (maxSeconds - minSeconds + 1),
      )
      core.info(`Waiting ${seconds} seconds before trying again`)
      await delay(seconds * 1000)
      attempt += 1
    }
  }
}

/**
 * A single download attempt: fetch the url (following redirects) and stream
 * the body into dest, deleting the partial file on failure.
 *
 * @param {string} url - Url of the tool to download.
 * @param {string} dest - Path to download to.
 * @param {string} [auth] - Authorization header value.
 *
 * @returns {Promise<string>} Path to the downloaded tool.
 */
export async function downloadToolAttempt(url, dest, auth) {
  if (existsSync(dest)) {
    throw new Error(`Destination file path ${dest} already exists`)
  }
  const headers = { 'user-agent': USER_AGENT }
  if (auth) {
    core.debug('set auth')
    headers['authorization'] = auth
  }
  const response = await globalThis.fetch(url, {
    headers,
    redirect: 'follow',
  })
  if (response.status !== 200 || !response.body) {
    core.debug(
      `Failed to download from "${url}". Code(${response.status}) Message(${response.statusText})`,
    )
    throw new HTTPError(response.status)
  }
  let succeeded = false
  try {
    await pipeline(Readable.fromWeb(response.body), createWriteStream(dest))
    core.debug('download complete')
    succeeded = true
    return dest
  } finally {
    // On error, delete dest before any retry.
    if (!succeeded) {
      core.debug('download failed')
      try {
        await safeDelete(dest)
      } catch (e) {
        core.debug(`Failed to delete '${dest}'. ${errorMessage(e)}`)
      }
    }
  }
}

/**
 * Finds the path to a tool version in the local installed tool cache,
 * honoring the `.complete` marker cacheDir/cacheFile write.
 *
 * @param {string} toolName - Name of the tool.
 * @param {string} versionSpec - Explicit version of the tool.
 * @param {string} [arch] - Architecture; defaults to the machine's.
 *
 * @returns {string} The cached directory path, or '' when not cached.
 */
export function findTool(toolName, versionSpec, arch) {
  if (!toolName) {
    throw new Error('toolName parameter is required')
  }
  if (!versionSpec) {
    throw new Error('versionSpec parameter is required')
  }
  const archToUse = arch || os.arch()
  const version = semverClean(versionSpec)
  if (!version) {
    // Upstream resolves ranges here via semver; this slice's call sites only
    // ever pass a resolved release tag, so a non-explicit spec is a miss.
    core.debug(`not an explicit version: ${versionSpec}`)
    return ''
  }
  const cachePath = path.join(getCacheDirectory(), toolName, version, archToUse)
  core.debug(`checking cache: ${cachePath}`)
  if (existsSync(cachePath) && existsSync(`${cachePath}.complete`)) {
    core.debug(`Found tool in cache ${toolName} ${version} ${archToUse}`)
    return cachePath
  }
  core.debug('not found')
  return ''
}

/**
 * Gets a global override, the seam upstream uses for test knobs like the
 * retry wait bounds.
 *
 * @param {string} key - Global variable name.
 * @param {number} defaultValue - Value when the global is unset.
 *
 * @returns {number} The override or the default.
 */
export function getGlobalOverride(key, defaultValue) {
  const value = globalThis[key]
  return value === undefined ? defaultValue : value
}

/**
 * Whether a failed download attempt should be retried: everything except an
 * HTTP client error (under 500, excluding 408 Request Timeout and 429 Too
 * Many Requests).
 *
 * @param {unknown} e - The attempt's error.
 *
 * @returns {boolean} Whether to retry.
 */
export function isRetryableDownloadError(e) {
  if (e instanceof HTTPError && e.httpStatusCode) {
    return (
      e.httpStatusCode >= 500 ||
      e.httpStatusCode === 408 ||
      e.httpStatusCode === 429
    )
  }
  return true
}

/**
 * Cleans a version to bare `X.Y.Z[-prerelease][+build]`, accepting the
 * loose `v`/`=` prefixes semver.clean() accepts.
 *
 * @param {string} version - Version to clean.
 *
 * @returns {string | undefined} The cleaned version, or undefined when not
 *   an explicit semver version.
 */
export function semverClean(version) {
  const match = EXPLICIT_VERSION_PATTERN.exec(version)
  return match ? match[1] : undefined
}

export const toolCache = {
  cacheDir,
  cacheFile,
  downloadTool,
  extractTar,
  extractZip,
  find: findTool,
  HTTPError,
}
