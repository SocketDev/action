import { core } from '../toolkit/core.js'
import { execCommand } from '../toolkit/exec.js'
import { toolCache as tool } from '../toolkit/tool-cache.js'
import path from 'node:path'

import { errorMessage } from '@socketsecurity/lib/errors/message'

import { resolveReleaseTag } from './github-release.js'

// supported distributions map
const distributions = {
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

// executable name
const nameExec =
  process.platform === 'win32' ? 'socket-patch.exe' : 'socket-patch'

/**
 * Downloads socket-patch binary if not in cache, and runs socket-patch apply.
 *
 * @param {object} inputs Action inputs.
 */
export async function patch(inputs) {
  const distributionKey = `${process.platform}-${process.arch}`
  const distribution = distributions[distributionKey]

  // exit early
  if (!distribution) {
    throw new Error(`Unsupported architecture ${distributionKey}`)
  }

  // check github releases for matching version; the tag_name is the version
  // to download
  let versionToDownload

  try {
    versionToDownload = await resolveReleaseTag({
      owner: 'SocketDev',
      repo: 'socket-patch',
      tag:
        inputs.versionPatch === 'latest'
          ? undefined
          : `v${inputs.versionPatch}`,
      token: inputs.tokenGithub,
    })
  } catch (error) {
    core.debug(`[${error?.status}] ${error?.url} ${errorMessage(error)}`)
    throw new Error(`failed to check version ${inputs.versionPatch}`)
  }

  // construct the download url
  const url = `https://github.com/SocketDev/socket-patch/releases/download/${versionToDownload}/${distribution.archive}`

  let pathCache

  // find previous cache entry
  if (inputs.useCache) {
    pathCache = tool.find('socket-patch', versionToDownload, process.arch)
  }

  // no cache, download new
  if (!pathCache) {
    core.debug(`downloading socket-patch binary from: ${url}`)

    try {
      // download it
      const pathDownload = await tool.downloadTool(url)

      // extract it
      let extractedPath
      if (distribution.ext === 'zip') {
        extractedPath = await tool.extractZip(pathDownload)
      } else {
        extractedPath = await tool.extractTar(pathDownload)
      }

      // cache it
      pathCache = await tool.cacheDir(
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

  const pathBinary = path.join(pathCache, nameExec)

  // make executable on Unix systems
  if (process.platform !== 'win32') {
    await execCommand('chmod', ['+x', pathBinary])
  }

  // send to outputs
  core.setOutput('patch-path-binary', pathBinary)

  // Add to $PATH
  core.addPath(pathCache)

  core.info(
    `socket-patch installed, requested: ${inputs.versionPatch}, resolved: ${versionToDownload}`,
  )

  core.debug(`binary location: ${pathCache}`)

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
  await execCommand(pathBinary, args)
}
