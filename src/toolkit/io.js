/**
 * @file Minimal GitHub Actions io slice — the `which` surface of
 *   `@actions/io` this action consumes, re-homed on node builtins so the npm
 *   dependency stays out of the supply chain. Semantics mirror
 *   `@actions/io@1.1.3`: a left-to-right PATH walk that honors PATHEXT on
 *   win32 and the execute bit elsewhere, returning the first match or an
 *   empty string, and throwing the upstream "Unable to locate executable
 *   file" error when `check` is set.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'

const IS_WINDOWS = process.platform === 'win32'

/**
 * Returns all occurrences of the given tool on the system path, in PATH
 * order.
 *
 * @param {string} tool - Name of the tool.
 *
 * @returns {Promise<string[]>} Full paths of every match.
 */
export async function findInPath(tool) {
  if (!tool) {
    throw new Error("parameter 'tool' is required")
  }
  // Build the list of extensions to try.
  const extensions = []
  if (IS_WINDOWS && process.env['PATHEXT']) {
    const pathExtEntries = process.env['PATHEXT'].split(path.delimiter)
    for (let i = 0, { length } = pathExtEntries; i < length; i += 1) {
      const extension = pathExtEntries[i]
      if (extension) {
        extensions.push(extension)
      }
    }
  }
  // If it's rooted, return it if it exists, otherwise return empty.
  if (isRooted(tool)) {
    const filePath = await tryGetExecutablePath(tool, extensions)
    return filePath ? [filePath] : []
  }
  // If any path separators, return empty. Consistent across platforms: the
  // current directory is a shell concern, not a which() concern.
  if (tool.includes(path.sep)) {
    return []
  }
  const directories = []
  if (process.env['PATH']) {
    const pathEntries = process.env['PATH'].split(path.delimiter)
    for (let i = 0, { length } = pathEntries; i < length; i += 1) {
      const p = pathEntries[i]
      if (p) {
        directories.push(p)
      }
    }
  }
  const matches = []
  for (let i = 0, { length } = directories; i < length; i += 1) {
    const filePath = await tryGetExecutablePath(
      path.join(directories[i], tool),
      extensions,
    )
    if (filePath) {
      matches.push(filePath)
    }
  }
  return matches
}

/**
 * On macOS/Linux, true when the path starts with '/'. On Windows, true for
 * paths like: \, \hello, \\hello\share, C:, and C:\hello.
 *
 * @param {string} p - Path to test.
 *
 * @returns {boolean} Whether the path is rooted.
 */
export function isRooted(p) {
  const normalized = normalizeSeparators(p)
  if (!normalized) {
    throw new Error('isRooted() parameter "p" cannot be empty')
  }
  if (IS_WINDOWS) {
    return normalized.startsWith('\\') || /^[A-Z]:/i.test(normalized)
  }
  return normalized.startsWith('/')
}

/**
 * On Mac/Linux, tests the execute bit against the process's uid/gid.
 *
 * @param {import('node:fs').Stats} stats - File stats.
 *
 * @returns {boolean} Whether the file is executable by this process.
 */
export function isUnixExecutable(stats) {
  return (
    (stats.mode & 1) > 0 ||
    ((stats.mode & 8) > 0 && stats.gid === process.getgid()) ||
    ((stats.mode & 64) > 0 && stats.uid === process.getuid())
  )
}

/**
 * Collapses redundant slashes and, on Windows, converts forward slashes to
 * backslashes.
 *
 * @param {string} p - Path to normalize.
 *
 * @returns {string} The normalized path.
 */
export function normalizeSeparators(p) {
  const value = p || ''
  if (IS_WINDOWS) {
    return value.replace(/\//g, '\\').replace(/\\\\+/g, '\\')
  }
  return value.replace(/\/\/+/g, '/')
}

/**
 * Best-effort check whether a file exists and is executable, trying each
 * PATHEXT extension on Windows.
 *
 * @param {string} filePath - File path to check.
 * @param {string[]} extensions - Additional file extensions to try.
 *
 * @returns {Promise<string>} The executable's path, or '' when not found.
 */
export async function tryGetExecutablePath(filePath, extensions) {
  const statOrUndefined = async p => {
    try {
      // socket-lint: allow stat-for-metadata — needs isFile() + mode bits.
      return await fs.stat(p)
    } catch {
      return undefined
    }
  }
  let stats = await statOrUndefined(filePath)
  if (stats?.isFile()) {
    if (IS_WINDOWS) {
      // On Windows, test for a valid extension.
      const upperExt = path.extname(filePath).toUpperCase()
      if (extensions.some(validExt => validExt.toUpperCase() === upperExt)) {
        return filePath
      }
    } else if (isUnixExecutable(stats)) {
      return filePath
    }
  }
  // Try each extension.
  for (const extension of extensions) {
    let candidate = filePath + extension
    stats = await statOrUndefined(candidate)
    if (stats?.isFile()) {
      if (IS_WINDOWS) {
        // Preserve the case of the actual file, since an extension was
        // appended.
        try {
          const directory = path.dirname(candidate)
          const upperName = path.basename(candidate).toUpperCase()
          for (const actualName of await fs.readdir(directory)) {
            if (upperName === actualName.toUpperCase()) {
              candidate = path.join(directory, actualName)
              break
            }
          }
        } catch {
          // Keep the appended-extension casing when the directory read fails.
        }
        return candidate
      }
      if (isUnixExecutable(stats)) {
        return candidate
      }
    }
  }
  return ''
}

/**
 * Returns the path of a tool had the tool actually been invoked, resolving
 * via the PATH environment variable.
 *
 * @param {string} tool - Name of the tool.
 * @param {boolean} [check] - Whether to throw when the tool is missing.
 *
 * @returns {Promise<string>} Path to the tool, or '' when not found and
 *   check is falsy.
 */
export async function which(tool, check) {
  if (!tool) {
    throw new Error("parameter 'tool' is required")
  }
  if (check) {
    const result = await which(tool, false)
    if (!result) {
      if (IS_WINDOWS) {
        throw new Error(
          `Unable to locate executable file: ${tool}. Please verify either the file path exists or the file can be found within a directory specified by the PATH environment variable. Also verify the file has a valid extension for an executable file.`,
        )
      }
      throw new Error(
        `Unable to locate executable file: ${tool}. Please verify either the file path exists or the file can be found within a directory specified by the PATH environment variable. Also check the file mode to verify the file is executable.`,
      )
    }
    return result
  }
  const matches = await findInPath(tool)
  if (matches.length > 0) {
    return matches[0]
  }
  return ''
}

export const io = {
  findInPath,
  which,
}
