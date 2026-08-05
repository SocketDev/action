/**
 * @file Canonical owner of the GitHub Actions runner directory paths the
 *   toolkit slices build on — RUNNER_TOOL_CACHE for cached tools and
 *   RUNNER_TEMP for downloads/extractions. Mirrors the private
 *   `_getCacheDirectory`/`_getTempDirectory` helpers of
 *   `@actions/tool-cache@2.0.2`.
 */

import { ok } from 'node:assert'

/**
 * Gets RUNNER_TOOL_CACHE.
 *
 * @returns {string} The tool cache directory.
 */
export function getCacheDirectory() {
  const cacheDirectory = process.env['RUNNER_TOOL_CACHE'] || ''
  ok(cacheDirectory, 'Expected RUNNER_TOOL_CACHE to be defined')
  return cacheDirectory
}

/**
 * Gets RUNNER_TEMP.
 *
 * @returns {string} The runner temp directory.
 */
export function getTempDirectory() {
  const tempDirectory = process.env['RUNNER_TEMP'] || ''
  ok(tempDirectory, 'Expected RUNNER_TEMP to be defined')
  return tempDirectory
}
