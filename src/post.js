import { readFile } from 'node:fs/promises'

import { debug, getInput, info, setFailed, summary } from '@actions/core'
import { PackageURL } from 'packageurl-js'

import { assertFirewallShimPrecedence } from './tools/firewall-shims.js'

export async function writeFirewallSummary() {
  // should show job summary?
  const inputs = {
    jobSummary: getInput('job-summary', { required: false }).toLowerCase(),
  }

  // backward compatibility
  if (inputs.jobSummary === 'true') {
    inputs.jobSummary = 'all'
  }
  if (inputs.jobSummary === 'false') {
    inputs.jobSummary = 'none'
  }

  // exit early
  if (inputs.jobSummary === 'none') {
    info('skipping firewall job summary')
    return
  }

  // failed in setup
  if (!process.env.SFW_JSON_REPORT_PATH) {
    info('firewall report path not set')
    return
  }

  let report

  try {
    debug(`reading report json from ${process.env.SFW_JSON_REPORT_PATH}`)
    const json = await readFile(process.env.SFW_JSON_REPORT_PATH)
    report = JSON.parse(json)
  } catch (error) {
    if (error.code === 'ENOENT') {
      info('no report output detected, skipping creation of job summary')
      return
    }

    debug(JSON.stringify(error))
    setFailed('error importing report json')
    process.exit(1)
  }

  summary.addRaw('<h2>Socket Firewall Report</h2>')

  if (!report.blocked && !report.parseFail) {
    if (inputs.jobSummary === 'errors') {
      info('no errors detected, skipping job summary')
      return
    }

    summary.addRaw('Nothing to report :tada:', true)
  }

  // blocked packages
  if (report.blocked) {
    summary.addRaw('<h3>Blocked :x:</h3>', true)

    const headers = [
      { data: 'Name', header: true },
      { data: 'Version', header: true },
      { data: 'Registry', header: true },
    ]

    const rows = []

    for (const p of report.blocked) {
      const { name, namespace, type, version } = PackageURL.fromString(
        p.purlString,
      )

      const fullName = namespace ? `${namespace}/${name}` : name

      const link = `https://socket.dev/${type}/package/${fullName}/overview/${version}`

      rows.push([
        `<a href="${link}">${fullName}</a>`,
        `<code>${version}</code>`,
        `<code>${p.registryFqdn}</code`,
      ])
    }

    summary.addTable([headers, ...rows])
  }

  // parse failures
  if (report.parseFail) {
    summary.addRaw('<h3>URL Parse Failure :warning:</h3>', true)

    const headers = [
      { data: 'URL', header: true },
      { data: 'Registry', header: true },
    ]

    const rows = []

    for (const p of report.parseFail) {
      rows.push([`<code>${p.urlPath}</code>`, `<code>${p.registryFqdn}</code`])
    }

    summary.addTable([headers, ...rows])
  }

  await summary.write()
}

/**
 * Render the firewall report left behind by the main step as a job summary.
 */
export async function main() {
  const mode = getInput('mode', { required: true }).toLowerCase()
  if (mode === 'patch') {
    info('patch mode: no post-run actions required')
    return
  }

  await assertFirewallShimPrecedence()
  await writeFirewallSummary()
}

main().catch(error => {
  setFailed(`${error?.message ?? String(error)}`)
  process.exit(1)
})
