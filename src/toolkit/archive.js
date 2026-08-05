/**
 * @file The extraction half of the first-party tool-cache slice — the
 *   `extractTar`/`extractZip` surface of `@actions/tool-cache@2.0.2`,
 *   mirroring its per-platform commands: tar with the GNU/BSD flag split,
 *   unzip on macOS/Linux, and pwsh/powershell ExtractToDirectory with the
 *   Expand-Archive fallback on Windows. Consumed through the `toolCache`
 *   aggregate in `tool-cache.js`.
 */

import crypto from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'

import { normalizePath } from '@socketsecurity/lib/paths/normalize'

import { core } from './core.js'
import { execCommand } from './exec.js'
import { which } from './io.js'
import { getTempDirectory } from './runner-paths.js'

const IS_WINDOWS = process.platform === 'win32'

/**
 * Ensures an extraction destination exists, defaulting to a GUID directory
 * under RUNNER_TEMP.
 *
 * @param {string} [dest] - Destination directory.
 *
 * @returns {Promise<string>} The destination directory.
 */
export async function createExtractFolder(dest) {
  const destination = dest || path.join(getTempDirectory(), crypto.randomUUID())
  await fs.mkdir(destination, { recursive: true })
  return destination
}

/**
 * Extracts a compressed tar archive.
 *
 * @param {string} file - Path to the tar.
 * @param {string} [dest] - Destination directory; defaults to a GUID under
 *   RUNNER_TEMP.
 * @param {string | string[]} [flags] - Flags for the tar command; defaults
 *   to 'xz' (extracting gzipped tars).
 *
 * @returns {Promise<string>} Path to the destination directory.
 */
export async function extractTar(file, dest, flags = 'xz') {
  if (!file) {
    throw new Error("parameter 'file' is required")
  }
  const destination = await createExtractFolder(dest)
  // Determine whether GNU tar: its flags differ from BSD tar's below.
  core.debug('Checking tar --version')
  let versionOutput = ''
  await execCommand('tar', ['--version'], {
    ignoreReturnCode: true,
    listeners: {
      stderr: data => (versionOutput += data.toString()),
      stdout: data => (versionOutput += data.toString()),
    },
    silent: true,
  })
  core.debug(versionOutput.trim())
  const isGnuTar = versionOutput.toUpperCase().includes('GNU TAR')
  const args = Array.isArray(flags) ? [...flags] : [flags]
  if (core.isDebug() && !flags.includes('v')) {
    args.push('-v')
  }
  let destArg = destination
  let fileArg = file
  if (IS_WINDOWS && isGnuTar) {
    args.push('--force-local')
    destArg = normalizePath(destination)
    // Technically only the dest needs `/`, but for aesthetic consistency
    // convert slashes in the file arg too.
    fileArg = normalizePath(file)
  }
  if (isGnuTar) {
    // Suppress warnings when using GNU tar to extract archives created by
    // BSD tar.
    args.push('--warning=no-unknown-keyword', '--overwrite')
  }
  args.push('-C', destArg, '-f', fileArg)
  await execCommand('tar', args)
  return destination
}

/**
 * Extracts a zip archive.
 *
 * @param {string} file - Path to the zip.
 * @param {string} [dest] - Destination directory; defaults to a GUID under
 *   RUNNER_TEMP.
 *
 * @returns {Promise<string>} Path to the destination directory.
 */
export async function extractZip(file, dest) {
  if (!file) {
    throw new Error("parameter 'file' is required")
  }
  const destination = await createExtractFolder(dest)
  if (IS_WINDOWS) {
    await extractZipWin(file, destination)
  } else {
    await extractZipNix(file, destination)
  }
  return destination
}

/**
 * Extracts a zip on macOS/Linux via the unzip binary.
 *
 * @param {string} file - Path to the zip.
 * @param {string} dest - Destination directory.
 */
export async function extractZipNix(file, dest) {
  const unzipPath = await which('unzip', true)
  const args = [file]
  if (!core.isDebug()) {
    args.unshift('-q')
  }
  // Overwrite with -o, otherwise a prompt is shown which freezes the run.
  args.unshift('-o')
  await execCommand(unzipPath, args, { cwd: dest })
}

/**
 * Extracts a zip on Windows via pwsh/powershell, preferring
 * ExtractToDirectory with Expand-Archive as the fallback so overwrite
 * behavior matches the nix path.
 *
 * @param {string} file - Path to the zip.
 * @param {string} dest - Destination directory.
 */
export async function extractZipWin(file, dest) {
  // Double-up single quotes, remove double quotes and newlines.
  const escapedFile = file.replace(/'/g, "''").replace(/"|\n|\r/g, '')
  const escapedDest = dest.replace(/'/g, "''").replace(/"|\n|\r/g, '')
  const pwshPath = await which('pwsh', false)
  if (pwshPath) {
    const pwshCommand = [
      `$ErrorActionPreference = 'Stop' ;`,
      `try { Add-Type -AssemblyName System.IO.Compression.ZipFile } catch { } ;`,
      `try { [System.IO.Compression.ZipFile]::ExtractToDirectory('${escapedFile}', '${escapedDest}', $true) }`,
      `catch { if (($_.Exception.GetType().FullName -eq 'System.Management.Automation.MethodException') -or ($_.Exception.GetType().FullName -eq 'System.Management.Automation.RuntimeException') ){ Expand-Archive -LiteralPath '${escapedFile}' -DestinationPath '${escapedDest}' -Force } else { throw $_ } } ;`,
    ].join(' ')
    const args = [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Unrestricted',
      '-Command',
      pwshCommand,
    ]
    core.debug(`Using pwsh at path: ${pwshPath}`)
    await execCommand(pwshPath, args)
    return
  }
  const powershellCommand = [
    `$ErrorActionPreference = 'Stop' ;`,
    `try { Add-Type -AssemblyName System.IO.Compression.FileSystem } catch { } ;`,
    `if ((Get-Command -Name Expand-Archive -Module Microsoft.PowerShell.Archive -ErrorAction Ignore)) { Expand-Archive -LiteralPath '${escapedFile}' -DestinationPath '${escapedDest}' -Force }`,
    `else {[System.IO.Compression.ZipFile]::ExtractToDirectory('${escapedFile}', '${escapedDest}', $true) }`,
  ].join(' ')
  const args = [
    '-NoLogo',
    '-Sta',
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Unrestricted',
    '-Command',
    powershellCommand,
  ]
  const powershellPath = await which('powershell', true)
  core.debug(`Using powershell at path: ${powershellPath}`)
  await execCommand(powershellPath, args)
}
