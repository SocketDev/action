import core from '@actions/core'
import { readFile } from 'node:fs/promises'

// should show job summary?
const jobSummary = core.getBooleanInput('job-summary', { required: false })

if (!jobSummary) {
  core.info('skipping firewall job summary')
  process.exit(0)
}

if (!process.env.SFW_JSON_REPORT_PATH) {
  core.info('firewall report path not set')
  process.exit(0)
}

let report

try {
  core.debug(`reading report json from ${process.env.SFW_JSON_REPORT_PATH}`)
  const json = await readFile(process.env.SFW_JSON_REPORT_PATH)
  report = JSON.parse(json)
} catch (error) {
  if (error.code === 'ENOENT') {
    core.info('no report output detected, skipping creation of job summary')
    process.exit(0)
  }

  core.debug(JSON.stringify(error))
  core.setFailed('error importing report json')
  process.exit(1)
}

await core.summary.addHeading('Socket Firewall Report')

if (!report.blocked && !report.parseFail) {
  core.summary.addRaw('Nothing to report :tada:', true)
}

// blocked packages
if (report.blocked) {
  core.summary.addRaw('<h3>Blocked :x:</h3>', true)

  const headers = [
    { data: 'Name', header: true },
    { data: 'Version', header: true },
    { data: 'Registry', header: true }
  ]

  const rows = []

  for (const p of report.blocked) {
    rows.push([p.name, `<code>${p.version}</code>`, `<code>${p.registryFqdn}</code`])
  }

  await core.summary.addTable([headers, ...rows])
}

// parse failures
if (report.parseFail) {
  core.summary.addRaw('<h3>URL Parse Failure :warning:</h3>', true)

  const headers = [
    { data: 'URL', header: true },
    { data: 'Registry', header: true }
  ]

  const rows = []

  for (const p of report.parseFail) {
    rows.push([`<code>${p.urlPath}</code>`, `<code>${p.registryFqdn}</code`])
  }

  await core.summary.addTable([headers, ...rows])
}

await core.summary.write()
