import core from '@actions/core'
import { readFile } from 'node:fs/promises'
import { PackageURL } from 'packageurl-js'

// should show job summary?
const inputs = {
  jobSummary: core.getInput('job-summary', { required: false }).toLowerCase()
}

// backward compatibility
if (inputs.jobSummary === 'true') inputs.jobSummary = 'all'
if (inputs.jobSummary === 'false') inputs.jobSummary = 'none'

// exit early
if (inputs.jobSummary === 'none') {
  core.info('skipping firewall job summary')
  process.exit(0)
}

// failed in setup
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

await core.summary.addRaw('<h2>Socket Firewall Report</h2>')

if (!report.blocked && !report.parseFail) {
  if (inputs.jobSummary === 'errors') {
    core.info('no errors detected, skipping job summary')
    process.exit(0)
  }

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
    const { type, namespace, name, version } = PackageURL.fromString(p.purlString)

    const fullName = namespace ? `${namespace}/${name}` : name

    const link = `https://socket.dev/${type}/package/${fullName}/overview/${version}`

    rows.push([`<a href="${link}">${fullName}</a>`, `<code>${version}</code>`, `<code>${p.registryFqdn}</code`])
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
