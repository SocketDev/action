import core from '@actions/core'
import exec from '@actions/exec'
import github from '@actions/github'
import tool from '@actions/tool-cache'
import path from 'node:path'

// supported distributions map
const distributions = {
  'linux-x64': { archive: 'socket-patch-x86_64-unknown-linux-musl.tar.gz', ext: 'tar.gz' },
  'linux-ia32': { archive: 'socket-patch-i686-unknown-linux-gnu.tar.gz', ext: 'tar.gz' },
  'linux-arm64': { archive: 'socket-patch-aarch64-unknown-linux-gnu.tar.gz', ext: 'tar.gz' },
  'linux-arm': { archive: 'socket-patch-arm-unknown-linux-gnueabihf.tar.gz', ext: 'tar.gz' },
  'darwin-x64': { archive: 'socket-patch-x86_64-apple-darwin.tar.gz', ext: 'tar.gz' },
  'darwin-arm64': { archive: 'socket-patch-aarch64-apple-darwin.tar.gz', ext: 'tar.gz' },
  'win32-x64': { archive: 'socket-patch-x86_64-pc-windows-msvc.zip', ext: 'zip' },
  'win32-ia32': { archive: 'socket-patch-i686-pc-windows-msvc.zip', ext: 'zip' },
  'win32-arm64': { archive: 'socket-patch-aarch64-pc-windows-msvc.zip', ext: 'zip' }
}

// executable name
const nameExec = process.platform === 'win32' ? 'socket-patch.exe' : 'socket-patch'

/**
 * downloads socket-patch binary if not in cache, and runs socket-patch apply
 * @param {object} inputs action inputs
 */
export default async function patch (inputs) {
  const distributionKey = `${process.platform}-${process.arch}`
  const distribution = distributions[distributionKey]

  // exit early
  if (!distribution) {
    throw new Error(`Unsupported architecture ${distributionKey}`)
  }

  // octokit client
  const octokit = github.getOctokit(inputs.tokenGithub, { userAgent: 'Socket-GitHub-Action' })

  // check github releases for matching version
  let response

  try {
    const method = inputs.versionPatch === 'latest' ? 'getLatestRelease' : 'getReleaseByTag'
    response = await octokit.rest.repos[method]({
      tag: inputs.versionPatch === 'latest' ? undefined : `v${inputs.versionPatch}`,
      owner: 'SocketDev',
      repo: 'socket-patch'
    })
  } catch (error) {
    core.debug(`[${error?.status}] ${error?.response?.url} ${error.message}`)
    throw new Error(`failed to check version ${inputs.versionPatch}`)
  }

  // use the tag_name as the version to download
  const { tag_name: versionToDownload } = response.data

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
      pathCache = await tool.cacheDir(extractedPath, 'socket-patch', versionToDownload, process.arch)
    } catch (error) {
      throw new Error(`Failed to download socket-patch binary: ${error}`)
    }
  }

  const pathBinary = path.join(pathCache, nameExec)

  // make executable on Unix systems
  if (process.platform !== 'win32') {
    await exec.exec('chmod', ['+x', pathBinary])
  }

  // send to outputs
  core.setOutput('patch-path-binary', pathBinary)

  // Add to $PATH
  core.addPath(pathCache)

  core.info(`socket-patch installed, requested: ${inputs.versionPatch}, resolved: ${versionToDownload}`)

  core.debug(`binary location: ${pathCache}`)

  const args = ['apply']
  if (inputs.patchEcosystems) args.push('--ecosystems', inputs.patchEcosystems)
  if (inputs.patchDryRun) args.push('--dry-run')
  if (inputs.patchCwd) args.push('--cwd', inputs.patchCwd)
  await exec.exec(pathBinary, args)
}
