import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { safeDelete } from '@socketsecurity/lib-stable/fs/safe'
import { spawn } from '@socketsecurity/lib/process/spawn/child'
import { afterEach, describe, expect, it } from 'vitest'

const sourceRoot = path.resolve('src')
const fixtureRoots = new Set<string>()

interface Fixture {
  root: string
  runnerTemp: string
  runtimeDirectory: string
  firewallBinary: string
  githubPath: string
  githubEnv: string
  basePath: string
}

interface SetupResult {
  state: string
}

function writeTool(directory: string, name: string, output: string): string {
  mkdirSync(directory, { recursive: true })
  const extension = process.platform === 'win32' ? '.cmd' : ''
  const filename = path.join(directory, `${name}${extension}`)
  if (process.platform === 'win32') {
    writeFileSync(filename, `@echo off\r\necho ${output}\r\n`)
  } else {
    writeFileSync(filename, `#!/bin/sh\nprintf '%s\\n' '${output}'\n`, {
      mode: 0o755,
    })
  }
  return filename
}

function writeFirewall(directory: string): string {
  mkdirSync(directory, { recursive: true })
  if (process.platform === 'win32') {
    const filename = path.join(directory, 'sfw.cmd')
    writeFileSync(
      filename,
      '@echo off\r\necho firewall\r\ncall %*\r\nexit /b %errorlevel%\r\n',
    )
    return filename
  }

  const filename = path.join(directory, 'sfw')
  writeFileSync(filename, '#!/bin/sh\nprintf "%s\\n" firewall\nexec "$@"\n', {
    mode: 0o755,
  })
  return filename
}

function makeFixture(): Fixture {
  const root = mkdtempSync(path.join(os.tmpdir(), 'firewall order '))
  fixtureRoots.add(root)
  const runnerTemp = path.join(root, 'runner temp')
  const runtimeDirectory = path.join(root, 'node runtime')
  mkdirSync(runnerTemp, { recursive: true })
  mkdirSync(runtimeDirectory, { recursive: true })
  const firewallBinary = writeFirewall(root)
  writeTool(runtimeDirectory, 'npm', 'npm-runtime')
  writeTool(runtimeDirectory, 'pnpm', 'pnpm-runtime')
  writeTool(runtimeDirectory, 'yarn', 'yarn-runtime')
  const githubPath = path.join(root, 'github path')
  const githubEnv = path.join(root, 'github env')
  writeFileSync(githubPath, '')
  writeFileSync(githubEnv, '')
  return {
    root,
    runnerTemp,
    runtimeDirectory,
    firewallBinary,
    githubPath,
    githubEnv,
    basePath: runtimeDirectory,
  }
}

async function runNodeScript(
  fixture: Fixture,
  script: string,
  environment: NodeJS.ProcessEnv,
  expectedStatus = 0,
): Promise<string> {
  const scriptPath = path.join(fixture.root, 'runner-script.mjs')
  const childEnvironment = { ...environment }
  childEnvironment['NODE_OPTIONS'] = ''
  writeFileSync(scriptPath, script)
  const result = await spawn(process.execPath, [scriptPath], {
    env: childEnvironment,
    stdioString: true,
    throws: false,
  })
  if (result.code !== expectedStatus) {
    throw new Error(result.stderr || `Runner exited with ${result.code}`)
  }
  return result.stdout
}

function runnerEnvironment(
  fixture: Fixture,
  pathValue: string,
  statePath: string,
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: pathValue,
    RUNNER_TEMP: fixture.runnerTemp,
    GITHUB_PATH: fixture.githubPath,
    GITHUB_ENV: fixture.githubEnv,
    GITHUB_STATE: statePath,
  }
  environment['SOCKET_SHIM_ACTIVE_NPM'] = ''
  environment['SOCKET_SHIM_ACTIVE_PNPM'] = ''
  environment['SOCKET_SHIM_ACTIVE_YARN'] = ''
  return environment
}

function readSavedState(statePath: string): string {
  const lines = readFileSync(statePath, 'utf8').split(/\r?\n/)
  const header = lines[0]
  const delimiterMatch = header?.match(/^firewall-shims<<(.+)$/)
  if (!delimiterMatch) {
    throw new Error('The action did not save firewall shim state')
  }
  const delimiter = delimiterMatch[1] ?? ''
  const end = lines.indexOf(delimiter, 1)
  if (end <= 1) {
    throw new Error('The action saved an invalid firewall shim state')
  }
  return lines.slice(1, end).join('\n')
}

async function runSetup(
  fixture: Fixture,
  pathValue: string,
  stateFileName: string,
): Promise<SetupResult> {
  const statePath = path.join(fixture.root, stateFileName)
  writeFileSync(statePath, '')
  const env = runnerEnvironment(fixture, pathValue, statePath)
  const shimModule = pathToFileURL(
    path.join(sourceRoot, 'tools/firewall-shims.js'),
  ).href
  await runNodeScript(
    fixture,
    `import { createFirewallShims } from ${JSON.stringify(shimModule)}\nawait createFirewallShims(${JSON.stringify(fixture.firewallBinary)}, 'free')\n`,
    env,
  )
  return { state: readSavedState(statePath) }
}

async function runLaterSetup(
  fixture: Fixture,
  directory: string,
): Promise<void> {
  const statePath = path.join(fixture.root, 'later-setup-state')
  writeFileSync(statePath, '')
  const coreModule = import.meta.resolve('@actions/core')
  const env = runnerEnvironment(
    fixture,
    pathAfterRunnerCommands(fixture),
    statePath,
  )
  await runNodeScript(
    fixture,
    `import { addPath } from ${JSON.stringify(coreModule)}\naddPath(${JSON.stringify(directory)})\n`,
    env,
  )
}

function pathAfterRunnerCommands(fixture: Fixture): string {
  let result = fixture.basePath
  const entries = readFileSync(fixture.githubPath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]
    if (entry) {
      result = `${entry}${path.delimiter}${result}`
    }
  }
  return result
}

function environmentWithState(
  fixture: Fixture,
  pathValue: string,
  state: string | undefined,
  summary: string,
  shims: string,
): NodeJS.ProcessEnv {
  const stateFile = path.join(fixture.root, 'post-state')
  writeFileSync(stateFile, '')
  return {
    ...runnerEnvironment(fixture, pathValue, stateFile),
    INPUT_MODE: 'firewall-free',
    'INPUT_JOB-SUMMARY': summary,
    INPUT_SHIMS: shims,
    SFW_JSON_REPORT_PATH: path.join(fixture.root, 'missing report.json'),
    ...(state === undefined ? {} : { 'STATE_firewall-shims': state }),
  }
}

interface PostOptions {
  state: string | undefined
  summary?: string | undefined
  shims?: string | undefined
  expectedStatus?: number | undefined
}

function runPost(
  fixture: Fixture,
  pathValue: string,
  options: PostOptions,
): Promise<string> {
  const postModule = pathToFileURL(path.join(sourceRoot, 'post.js')).href
  return runNodeScript(
    fixture,
    `import ${JSON.stringify(postModule)}\n`,
    environmentWithState(
      fixture,
      pathValue,
      options.state,
      options.summary ?? 'none',
      options.shims ?? 'true',
    ),
    options.expectedStatus ?? 0,
  )
}

async function runManager(
  fixture: Fixture,
  command: string,
  pathValue: string,
): Promise<string> {
  const env = runnerEnvironment(
    fixture,
    pathValue,
    path.join(fixture.root, 'manager-state'),
  )
  const isWindows = process.platform === 'win32'
  const executable = isWindows ? (process.env['ComSpec'] ?? 'cmd.exe') : command
  const args = isWindows ? ['/d', '/c', `${command} install`] : ['install']
  const result = await spawn(executable, args, {
    env,
    stdioString: true,
    throws: false,
  })
  if (result.code !== 0) {
    throw new Error(result.stderr || `${command} exited with ${result.code}`)
  }
  return result.stdout.replace(/\r\n/g, '\n').trim()
}

afterEach(async () => {
  for (const root of fixtureRoots) {
    await safeDelete(root, { recursive: true })
  }
  fixtureRoots.clear()
})

describe('firewall shim ordering diagnostics', () => {
  it('keeps installed shims first on the initial job PATH', async () => {
    const fixture = makeFixture()
    const setup = await runSetup(fixture, fixture.basePath, 'initial-state')
    const pathValue = pathAfterRunnerCommands(fixture)
    expect(setup.state).toContain('"completedCommands":["npm","pnpm","yarn"]')
    expect(await runManager(fixture, 'npm', pathValue)).toContain(
      'firewall\nnpm-runtime',
    )
    expect(await runManager(fixture, 'pnpm', pathValue)).toContain(
      'firewall\npnpm-runtime',
    )
    expect(await runManager(fixture, 'yarn', pathValue)).toContain(
      'firewall\nyarn-runtime',
    )
    expect(
      await runPost(fixture, pathValue, { state: setup.state }),
    ).not.toContain('::warning::')
  })

  it('fails when later npm setup shadows the shim', async () => {
    const fixture = makeFixture()
    const setup = await runSetup(fixture, fixture.basePath, 'initial-state')
    const nodeDirectory = path.join(fixture.root, 'later node setup')
    writeTool(nodeDirectory, 'npm', 'later-node-npm')
    await runLaterSetup(fixture, nodeDirectory)
    const pathValue = pathAfterRunnerCommands(fixture)

    expect(await runManager(fixture, 'npm', pathValue)).toContain(
      'later-node-npm',
    )
    expect(await runManager(fixture, 'pnpm', pathValue)).toContain(
      'firewall\npnpm-runtime',
    )
    expect(await runManager(fixture, 'yarn', pathValue)).toContain(
      'firewall\nyarn-runtime',
    )
    expect(
      await runPost(fixture, pathValue, {
        state: setup.state,
        expectedStatus: 1,
      }),
    ).toContain('Firewall command precedence changed during the job: npm')
  })

  it('uses the later runtime when the action runs again', async () => {
    const fixture = makeFixture()
    await runSetup(fixture, fixture.basePath, 'initial-state')
    const nodeDirectory = path.join(fixture.root, 'later node setup')
    writeTool(nodeDirectory, 'npm', 'later-node-npm')
    await runLaterSetup(fixture, nodeDirectory)

    const setup = await runSetup(
      fixture,
      pathAfterRunnerCommands(fixture),
      'rerun-state',
    )
    const pathValue = pathAfterRunnerCommands(fixture)

    expect(await runManager(fixture, 'npm', pathValue)).toContain(
      'firewall\nlater-node-npm',
    )
    expect(
      await runPost(fixture, pathValue, { state: setup.state }),
    ).not.toContain('::warning::')
  })

  it('warns when a previously shimmed command is now missing', async () => {
    const fixture = makeFixture()
    const setup = await runSetup(fixture, fixture.basePath, 'initial-state')
    const shimDirectory = path.join(fixture.runnerTemp, 'sfw-shim')
    await safeDelete(
      path.join(
        shimDirectory,
        process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ),
    )
    await safeDelete(
      path.join(
        fixture.runtimeDirectory,
        process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ),
    )
    const pathValue = `${shimDirectory}${path.delimiter}${fixture.runtimeDirectory}`

    expect(await runPost(fixture, pathValue, { state: setup.state })).toContain(
      'npm (missing)',
    )
  })

  it('fails when saved shim state is invalid', async () => {
    const fixture = makeFixture()
    const output = await runPost(fixture, fixture.basePath, {
      state: 'invalid state',
      expectedStatus: 1,
    })

    expect(output).toContain('saved action state is invalid')
  })

  it('warns before summary-none and missing-report exits and skips without state', async () => {
    const fixture = makeFixture()
    const setup = await runSetup(fixture, fixture.basePath, 'initial-state')
    const pathValue = pathAfterRunnerCommands(fixture)
    const shimExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    await safeDelete(path.join(fixture.runnerTemp, 'sfw-shim', shimExecutable))
    await safeDelete(path.join(fixture.runtimeDirectory, shimExecutable))

    expect(
      await runPost(fixture, pathValue, {
        state: setup.state,
      }),
    ).toContain('npm (missing)')
    const missingReport = await runPost(fixture, pathValue, {
      state: setup.state,
      summary: 'all',
    })
    expect(missingReport).toContain('npm (missing)')
    expect(missingReport).toContain('no report output detected')
    expect(
      await runPost(fixture, pathValue, {
        state: undefined,
        shims: 'false',
      }),
    ).not.toContain('::warning::')
  })
})
