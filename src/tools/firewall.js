import crypto from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'

import {
  addPath,
  debug,
  exportVariable,
  info,
  setOutput,
  warning,
} from '@actions/core'
import { exec } from '@actions/exec'
import { which } from '@actions/io'
import { cacheFile, downloadTool, find } from '@actions/tool-cache'

import { errorMessage } from '@socketsecurity/lib/errors/message'
import { fromUnixPath } from '@socketsecurity/lib/paths/conversion'

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
export const FIREWALL_VERSION = 'v1.6.1'

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
      'acad0b517601bb7408e2e611c9226f47dcccbd83333d7fc5157f1d32ed2b953d',
    'darwin-x64':
      '01d64d40effda35c31f8d8ee1fed1388aac0a11aba40d47fba8a36024b77500c',
    'linux-arm64':
      '671270231617142404a1564e52672f79b806f9df3f232fcc7606329c0246da55',
    'linux-x64':
      '9115b4ca8021eb173eb9e9c3627deb7f1066f8debd48c5c9d9f3caabb2a26a4b',
    'win32-x64':
      '9a50e1ddaf038138c3f85418dc5df0113bbe6fc884f5abe158beaa9aea18d70a',
  },
  free: {
    'darwin-arm64':
      'bf1616fc44ac49f1cb2067fedfa127a3ae65d6ec6d634efbb3098cfa355e5555',
    'darwin-x64':
      '724ccea19d847b79db8cc8e38f5f18ce2dd32336007f42b11bed7d2e5f4a2566',
    'linux-arm64':
      'df2eedb2daf2572eee047adb8bfd81c9069edcb200fc7d3710fca98ec3ca81a1',
    'linux-x64':
      '4a1e8b65e90fce7d5fd066cf0af6c93d512065fa4222a475c8d959a6bc14b9ff',
    'win32-x64':
      'c953e62ad7928d4d8f2302f5737884ea1a757babc26bed6a42b9b6b68a5d54af',
  },
}

/**
 * Name the firewall binary is cached and executed under.
 */
export const FIREWALL_EXEC_NAME = 'sfw'

/**
 * Directory under `RUNNER_TEMP` the generated shims are written to.
 */
export const FIREWALL_SHIM_DIR_NAME = 'sfw-shim'

/**
 * Write a shim for every package manager sfw fronts and put the shim directory
 * first on PATH, so a workflow runs `npm install` rather than `sfw npm
 * install`. Each shim drops its own directory from PATH before calling sfw, so
 * sfw resolves the real binary instead of re-entering the shim. Windows gets a
 * `.cmd` shim beside the shell one so cmd.exe and PowerShell are covered.
 *
 * @param {string} firewallBinaryPath Full path to the installed sfw binary.
 * @param {string} edition Edition installed, `free` or `enterprise`.
 */
export async function createFirewallShims(firewallBinaryPath, edition) {
  // Writing into a stable directory means a second run of the action in the
  // same job overwrites its own shims rather than stacking a new set.
  const shimDir = path.join(process.env.RUNNER_TEMP, FIREWALL_SHIM_DIR_NAME)
  await fs.mkdir(shimDir, { recursive: true })

  // Git Bash on a Windows runner hands out MSYS paths such as
  // `/c/Users/runner`, which cmd.exe and PowerShell cannot resolve.
  const firewallPath = fromUnixPath(firewallBinaryPath)

  const shimmed = []

  // `which` reads PATH from the environment, so the shim directory comes off
  // it for the whole lookup pass. A second run of the action in the same job
  // inherits the first run's shim directory, and without this the new shims
  // would point at the old ones instead of at the real binaries.
  const runnerPath = process.env.PATH

  process.env.PATH = (runnerPath ?? '')
    .split(path.delimiter)
    .filter(entry => entry !== shimDir)
    .join(path.delimiter)

  try {
    for (const command of firewallShimCommands(edition)) {
      const found = await which(command, false)

      // not installed on this runner, nothing to front
      if (!found) {
        continue
      }

      const realPath = fromUnixPath(found)

      // The `grep -vxF` line strips the shim directory from PATH, so the sfw
      // call below resolves the real binary instead of re-entering this shim.
      const shellShim = [
        '#!/bin/sh',
        `export PATH="$(echo "$PATH" | tr ':' '\\n' | grep -vxF '${shimDir}' | paste -sd: -)"`,
        `exec "${firewallPath}" "${realPath}" "$@"`,
      ].join('\n')

      await fs.writeFile(path.join(shimDir, command), `${shellShim}\n`, {
        mode: 0o755,
      })

      if (process.platform === 'win32') {
        // cmd.exe has no filter, so the shim directory is cut out of PATH by
        // padding both ends with a separator and deleting the padded match.
        const cmdShim = [
          '@echo off',
          'set "PATH=;%PATH%;"',
          `set "PATH=%PATH:;${shimDir};=%"`,
          'set "PATH=%PATH:~1,-1%"',
          `"${firewallPath}" "${realPath}" %*`,
        ].join('\r\n')

        await fs.writeFile(
          path.join(shimDir, `${command}.cmd`),
          `${cmdShim}\r\n`,
        )
      }

      shimmed.push(command)
    }
  } finally {
    process.env.PATH = runnerPath
  }

  // PATH is searched left to right, so the shims have to land ahead of the
  // real binaries.
  addPath(shimDir)

  // Later steps read SFW_SHIM_DIR to disable the shims for a publish flow.
  exportVariable('SFW_SHIM_DIR', shimDir)

  info(`created shims for: ${shimmed.join(', ')}`)
}

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

  let versionToDownload = FIREWALL_VERSION

  // The pinned hashes describe FIREWALL_VERSION alone, so any other version is
  // a binary this table cannot vouch for.
  if (inputs.versionFirewall && inputs.versionFirewall !== 'latest') {
    versionToDownload = `v${inputs.versionFirewall}`
    warning(
      `Requested firewall version ${versionToDownload}, but the checksum is pinned to ${FIREWALL_VERSION}. Validation fails if the binary differs.`,
    )
  }

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

    let pathDownload

    try {
      // download it
      pathDownload = await downloadTool(url)
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
 * Package manager commands the given edition can front, a fresh list each call
 * so one caller cannot mutate the next caller's set. The free edition covers
 * the npm, Python, and Rust ecosystems; enterprise adds Ruby and .NET
 * everywhere, and Go on Linux.
 *
 * @param {string} edition Edition installed, `free` or `enterprise`.
 *
 * @returns {string[]} Command names to write a shim for.
 */
export function firewallShimCommands(edition) {
  const commands = ['cargo', 'npm', 'pip', 'pip3', 'pnpm', 'uv', 'yarn']
  if (edition !== 'enterprise') {
    return commands
  }
  commands.push('bundler', 'gem', 'nuget')
  if (process.platform === 'linux') {
    commands.push('go')
  }
  return commands
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
