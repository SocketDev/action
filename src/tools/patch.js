import path from 'node:path'

import { addPath, debug, info, setOutput } from '@actions/core'
import { exec } from '@actions/exec'
import { getOctokit } from '@actions/github'
import {
  cacheDir,
  downloadTool,
  extractTar,
  extractZip,
  find,
} from '@actions/tool-cache'

import { errorMessage } from '@socketsecurity/lib/errors/message'

/**
 * `<platform>-<arch>` (Node's own spelling) to the socket-patch release asset
 * for that build, plus the archive format it ships in. A key missing here is a
 * platform socket-patch does not publish a binary for, and the action fails
 * fast rather than downloading a 404.
 */
export const PATCH_DISTRIBUTIONS = {
  'darwin-arm64': {
    archive: 'socket-patch-aarch64-apple-darwin.tar.gz',
    ext: 'tar.gz',
  },
  'darwin-x64': {
    archive: 'socket-patch-x86_64-apple-darwin.tar.gz',
    ext: 'tar.gz',
  },
  'linux-arm': {
    archive: 'socket-patch-arm-unknown-linux-gnueabihf.tar.gz',
    ext: 'tar.gz',
  },
  'linux-arm64': {
    archive: 'socket-patch-aarch64-unknown-linux-gnu.tar.gz',
    ext: 'tar.gz',
  },
  'linux-ia32': {
    archive: 'socket-patch-i686-unknown-linux-gnu.tar.gz',
    ext: 'tar.gz',
  },
  'linux-x64': {
    archive: 'socket-patch-x86_64-unknown-linux-musl.tar.gz',
    ext: 'tar.gz',
  },
  'win32-arm64': {
    archive: 'socket-patch-aarch64-pc-windows-msvc.zip',
    ext: 'zip',
  },
  'win32-ia32': {
    archive: 'socket-patch-i686-pc-windows-msvc.zip',
    ext: 'zip',
  },
  'win32-x64': {
    archive: 'socket-patch-x86_64-pc-windows-msvc.zip',
    ext: 'zip',
  },
}

/**
 * Name the socket-patch binary is cached and executed under.
 */
export const PATCH_EXEC_NAME =
  process.platform === 'win32' ? 'socket-patch.exe' : 'socket-patch'

/**
 * Downloads socket-patch binary if not in cache, and runs socket-patch apply.
 *
 * @param {object} inputs Action inputs.
 */
export async function applyPatches(inputs) {
  const distributionKey = `${process.platform}-${process.arch}`
  const distribution = PATCH_DISTRIBUTIONS[distributionKey]

  // exit early
  if (!distribution) {
    throw new Error(`Unsupported architecture ${distributionKey}`)
  }

  // octokit client
  const octokit = getOctokit(inputs.tokenGithub, {
    userAgent: 'Socket-GitHub-Action',
  })

  // check github releases for matching version
  let response

  try {
    const method =
      inputs.versionPatch === 'latest' ? 'getLatestRelease' : 'getReleaseByTag'
    response = await octokit.rest.repos[method]({
      tag:
        inputs.versionPatch === 'latest'
          ? undefined
          : `v${inputs.versionPatch}`,
      owner: 'SocketDev',
      repo: 'socket-patch',
    })
  } catch (error) {
    debug(`[${error?.status}] ${error?.response?.url} ${errorMessage(error)}`)
    throw new Error(`failed to check version ${inputs.versionPatch}`)
  }

  // use the tag_name as the version to download
  const { tag_name: versionToDownload } = response.data

  // construct the download url
  const url = `https://github.com/SocketDev/socket-patch/releases/download/${versionToDownload}/${distribution.archive}`

  let pathCache

  // find previous cache entry
  if (inputs.useCache) {
    pathCache = find('socket-patch', versionToDownload, process.arch)
  }

  // no cache, download new
  if (!pathCache) {
    debug(`downloading socket-patch binary from: ${url}`)

    try {
      // download it
      const pathDownload = await downloadTool(url)

      // extract it
      const extractedPath =
        distribution.ext === 'zip'
          ? await extractZip(pathDownload)
          : await extractTar(pathDownload)

      // cache it
      pathCache = await cacheDir(
        extractedPath,
        'socket-patch',
        versionToDownload,
        process.arch,
      )
    } catch (error) {
      throw new Error(
        `Failed to download socket-patch binary: ${errorMessage(error)}`,
      )
    }
  }

  const pathBinary = path.join(pathCache, PATCH_EXEC_NAME)

  // make executable on Unix systems
  if (process.platform !== 'win32') {
    await exec('chmod', ['+x', pathBinary])
  }

  // send to outputs
  setOutput('patch-path-binary', pathBinary)

  // Add to $PATH
  addPath(pathCache)

  info(
    `socket-patch installed, requested: ${inputs.versionPatch}, resolved: ${versionToDownload}`,
  )

  debug(`binary location: ${pathCache}`)

  const args = ['apply']
  if (inputs.patchEcosystems) {
    args.push('--ecosystems', inputs.patchEcosystems)
  }
  if (inputs.patchDryRun) {
    args.push('--dry-run')
  }
  if (inputs.patchCwd) {
    args.push('--cwd', inputs.patchCwd)
  }
  await exec(pathBinary, args)
}
