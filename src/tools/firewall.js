import { core } from '../toolkit/core.js'
import { execCommand } from '../toolkit/exec.js'
import { io } from '../toolkit/io.js'
import { toolCache as tool } from '../toolkit/tool-cache.js'
import crypto from 'node:crypto'
import path from 'node:path'
import { existsSync, promises as fs } from 'node:fs'
import { safeDelete } from '@socketsecurity/lib-stable/fs/safe'

// supported distributions and their hardcoded SHA256 checksums
// these must be updated when a new sfw version is released
const releases = {
  enterprise: {
    version: 'v1.6.1',
    repo: 'firewall-release',
    checksums: {
      'linux-x64': {
        asset: 'sfw-linux-x86_64',
        sha256:
          '9115b4ca8021eb173eb9e9c3627deb7f1066f8debd48c5c9d9f3caabb2a26a4b',
      },
      'linux-arm64': {
        asset: 'sfw-linux-arm64',
        sha256:
          '671270231617142404a1564e52672f79b806f9df3f232fcc7606329c0246da55',
      },
      'darwin-x64': {
        asset: 'sfw-macos-x86_64',
        sha256:
          '01d64d40effda35c31f8d8ee1fed1388aac0a11aba40d47fba8a36024b77500c',
      },
      'darwin-arm64': {
        asset: 'sfw-macos-arm64',
        sha256:
          'acad0b517601bb7408e2e611c9226f47dcccbd83333d7fc5157f1d32ed2b953d',
      },
      'win32-x64': {
        asset: 'sfw-windows-x86_64.exe',
        sha256:
          '9a50e1ddaf038138c3f85418dc5df0113bbe6fc884f5abe158beaa9aea18d70a',
      },
    },
  },
  free: {
    version: 'v1.6.1',
    repo: 'sfw-free',
    checksums: {
      'linux-x64': {
        asset: 'sfw-free-linux-x86_64',
        sha256:
          '4a1e8b65e90fce7d5fd066cf0af6c93d512065fa4222a475c8d959a6bc14b9ff',
      },
      'linux-arm64': {
        asset: 'sfw-free-linux-arm64',
        sha256:
          'df2eedb2daf2572eee047adb8bfd81c9069edcb200fc7d3710fca98ec3ca81a1',
      },
      'darwin-x64': {
        asset: 'sfw-free-macos-x86_64',
        sha256:
          '724ccea19d847b79db8cc8e38f5f18ce2dd32336007f42b11bed7d2e5f4a2566',
      },
      'darwin-arm64': {
        asset: 'sfw-free-macos-arm64',
        sha256:
          'bf1616fc44ac49f1cb2067fedfa127a3ae65d6ec6d634efbb3098cfa355e5555',
      },
      'win32-x64': {
        asset: 'sfw-free-windows-x86_64.exe',
        sha256:
          'c953e62ad7928d4d8f2302f5737884ea1a757babc26bed6a42b9b6b68a5d54af',
      },
    },
  },
}

// package managers that sfw can shim
// free edition ecosystems
const shimCmdsFree = ['npm', 'pnpm', 'pip', 'pip3', 'uv', 'cargo', 'yarn']

// enterprise gets additional ecosystems
const shimCmdsEnterprise = [...shimCmdsFree, 'bundler', 'gem', 'nuget']

// executable name
const nameExec = 'sfw'

/**
 * Creates shim scripts for each package manager so commands like
 * "npm install" are transparently routed through sfw.
 *
 * Each shim strips its own directory from PATH before calling sfw
 * so sfw resolves the real binary instead of calling the shim again.
 *
 * On windows, MSYS paths (/c/Users/...) are normalized to native
 * format (C:\Users\...) so sfw and PowerShell work correctly.
 *
 * The shim dir is exported as SFW_SHIM_DIR so publish workflows can
 * temporarily disable shims by renaming them to .disabled.
 *
 * @param {string} sfwBinaryPath - Full path to the sfw binary.
 * @param {string} edition - 'free' or 'enterprise'
 */
export async function createShims(sfwBinaryPath, edition) {
  // make a temp folder for our shims, clear any stale ones first
  const shimDir = path.join(process.env.RUNNER_TEMP, 'sfw-shim')
  if (existsSync(shimDir)) {
    await safeDelete(shimDir)
  }
  await fs.mkdir(shimDir, { recursive: true })

  // pick the right ecosystem list based on edition
  const shimCmds = edition === 'enterprise' ? shimCmdsEnterprise : shimCmdsFree

  // on linux, enterprise also gets go shims
  if (edition === 'enterprise' && process.platform === 'linux') {
    shimCmds.push('go')
  }

  // normalize the sfw binary path on windows
  const sfwPath =
    process.platform === 'win32' ? msysToWinPath(sfwBinaryPath) : sfwBinaryPath

  // build a clean PATH without the shim dir so io.which finds real binaries
  const cleanPath = process.env.PATH.split(path.delimiter)
    .filter(p => p !== shimDir)
    .join(path.delimiter)

  for (const cmd of shimCmds) {
    // find the real binary on PATH (using clean PATH without shim dir)
    let realPath
    try {
      const origPath = process.env.PATH
      process.env.PATH = cleanPath
      realPath = await io.which(cmd, false)
      process.env.PATH = origPath
    } catch {
      // not installed, skip
    }
    if (!realPath) {
      continue
    }

    // normalize MSYS paths on windows (/c/Users/... -> C:\Users\...)
    if (process.platform === 'win32') {
      realPath = msysToWinPath(realPath)
    }

    // create a bash/sh shim (works on linux, mac, and windows git bash)
    const bashShimPath = path.join(shimDir, cmd)
    const bashScript =
      [
        '#!/bin/sh',
        // strip shim dir from PATH to prevent recursion
        `export PATH="$(echo "$PATH" | tr ':' '\\n' | grep -vxF '${shimDir}' | paste -sd: -)"`,
        `exec "${sfwPath}" "${realPath}" "$@"`,
      ].join('\n') + '\n'
    await fs.writeFile(bashShimPath, bashScript, { mode: 0o755 })

    // on windows also create a .cmd shim for cmd.exe / PowerShell
    if (process.platform === 'win32') {
      const cmdShimPath = path.join(shimDir, `${cmd}.cmd`)
      const cmdScript =
        [
          '@echo off',
          // strip shim dir from PATH so sfw resolves the real binary
          `set "PATH=;%PATH%;"`,
          `set "PATH=%PATH:;${shimDir};=%"`,
          `set "PATH=%PATH:~1,-1%"`,
          `"${sfwPath}" "${realPath}" %*`,
        ].join('\r\n') + '\r\n'
      await fs.writeFile(cmdShimPath, cmdScript)
    }
  }

  // add the shim folder to PATH BEFORE the real binaries
  // PATH is searched left to right so our shims get found first
  core.addPath(shimDir)

  // export SFW_SHIM_DIR so other steps can find and manage shims
  // (e.g. disable them for publish flows by renaming to .disabled)
  core.exportVariable('SFW_SHIM_DIR', shimDir)

  core.info(`created shims for: ${shimCmds.join(', ')}`)
}

/**
 * Downloads firewall binary if not in cache, validates its checksum,
 * and adds it to the exec path. handles both free and enterprise editions.
 * also sets up shims if enabled.
 *
 * @param {object} inputs - All the action inputs from the user.
 */
export async function download({ edition = 'free', ...inputs }) {
  const platformKey = `${process.platform}-${process.arch}`
  const release = releases[edition]

  if (!release) {
    throw new Error(`Unknown edition: ${edition}`)
  }

  const platformEntry = release.checksums[platformKey]

  if (!platformEntry) {
    throw new Error(`Unsupported platform ${platformKey}`)
  }

  const { asset: nameDownload, sha256: expectedHash } = platformEntry

  // use the user-specified version or fall back to the hardcoded one
  let versionToDownload = release.version

  // if user specified a version other than 'latest', use that
  if (inputs.versionFirewall && inputs.versionFirewall !== 'latest') {
    versionToDownload = `v${inputs.versionFirewall}`
    core.warning(
      `Using custom version ${versionToDownload}. Checksum validation will use the hardcoded hash for ${release.version} and may fail if the binary differs.`,
    )
  }

  // cache options
  const cacheOptions = [
    `socket-firewall-${edition}`,
    versionToDownload,
    process.arch,
  ]

  // construct the download url
  const url = `https://github.com/SocketDev/${release.repo}/releases/download/${versionToDownload}/${nameDownload}`

  let pathCache

  // check if we already downloaded this version before
  if (inputs.useCache) {
    pathCache = tool.find(...cacheOptions)
  }

  // no cache hit, gotta download it fresh
  if (!pathCache) {
    core.debug(`downloading Socket Firewall binary from: ${url}`)

    try {
      // download the binary
      const pathDownload = await tool.downloadTool(url)

      // validate the checksum against our hardcoded hash
      await validateChecksum(pathDownload, expectedHash)

      // cache it so we dont have to download again next time
      pathCache = await tool.cacheFile(pathDownload, nameExec, ...cacheOptions)
    } catch (error) {
      throw new Error(`Failed to download Socket Firewall binary: ${error}`)
    }
  }

  const pathBinary = path.join(pathCache, nameExec)

  // make executable on unix systems (linux/mac)
  if (process.platform !== 'win32') {
    await execCommand('chmod', ['+x', pathBinary])
  }

  // send to outputs so other steps can use the path
  core.setOutput('firewall-path-binary', pathBinary)

  // add sfw to PATH so you can call it from any step
  core.addPath(pathCache)

  core.info(
    `Socket Firewall ${edition} edition installed: ${versionToDownload}`,
  )

  core.debug(`binary location: ${pathCache}`)

  // create shims so "npm install" automatically goes through sfw
  if (inputs.shims) {
    await createShims(pathBinary, edition)
  }

  // set report path env so the post-run step can find the report
  if (inputs.jobSummary !== 'none') {
    const pathReport = `${path.join(process.env.RUNNER_TEMP, crypto.randomUUID())}.json`
    // set the env info to be used in "post.js" step
    core.exportVariable('SFW_JSON_REPORT_PATH', pathReport)

    // send to outputs
    core.setOutput('firewall-path-report', pathReport)

    core.debug(`report path set to : ${pathReport}`)
  }
}

/**
 * Figure out the sha256 hash of a file on disk
 * reads the whole file and hashes it with sha256.
 *
 * @param {string} filePath - Path to the file we want to hash.
 *
 * @returns {string} The hex-encoded sha256 hash
 */
export async function getFileChecksum(filePath) {
  const fileBuffer = await fs.readFile(filePath)
  const hash = crypto.createHash('sha256')
  hash.update(fileBuffer)
  return hash.digest('hex')
}

/**
 * Converts MSYS-style paths like /c/Users/... to native Windows paths
 * like C:\Users\... so sfw can find the real binary on Windows runners.
 * without this, sfw gets confused by the /c/ prefix from Git Bash.
 *
 * @param {string} p - Path that might be in MSYS format.
 *
 * @returns {string} Native Windows path or the original path unchanged
 */
export function msysToWinPath(p) {
  const match = p.match(/^\/([a-zA-Z])\/(.*)/)
  if (match) {
    return `${match[1].toUpperCase()}:\\${match[2].replace(/\//g, '\\')}`
  }
  return p
}

/**
 * Validates the sha256 checksum of a downloaded binary against the
 * hardcoded expected hash. this makes sure nobody tampered with the
 * binary between github and our runner.
 *
 * @param {string} binaryPath - Path to the downloaded binary.
 * @param {string} expectedHash - The expected sha256 hash.
 */
export async function validateChecksum(binaryPath, expectedHash) {
  core.info('validating checksum of downloaded binary…')

  const actualHash = await getFileChecksum(binaryPath)

  core.debug(`expected checksum: ${expectedHash}`)
  core.debug(`actual checksum:   ${actualHash}`)

  if (actualHash !== expectedHash) {
    throw new Error(
      `Checksum mismatch! Binary may have been tampered with.\n` +
        `Expected: ${expectedHash}\n` +
        `Got:      ${actualHash}`,
    )
  }

  core.info('checksum validation passed')
}
