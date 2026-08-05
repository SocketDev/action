/**
 * @file Minimal GitHub Actions core slice — the surface of `@actions/core`
 *   this action consumes (inputs, outputs, env/path exports, workflow
 *   commands, job summary), re-homed on node builtins so the npm dependency
 *   stays out of the supply chain. Semantics mirror `@actions/core@1.11.1`.
 *   Growth path: if the action ever needs more of the toolkit, port it as a
 *   wheelhouse upstream/* lockstep slice instead of re-adding the dependency.
 */

import crypto from 'node:crypto'
import { appendFileSync, existsSync, promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Prepends inputPath to the PATH (for this action and future actions).
 *
 * @param {string} inputPath Directory to prepend.
 */
export function addPath(inputPath) {
  const filePath = process.env['GITHUB_PATH'] || ''
  if (filePath) {
    issueFileCommand('PATH', inputPath)
  } else {
    issueCommand('add-path', {}, inputPath)
  }
  process.env['PATH'] = `${inputPath}${path.delimiter}${process.env['PATH']}`
}

/**
 * Writes a debug message to the user log.
 *
 * @param {string} message Debug message.
 */
export function debug(message) {
  issueCommand('debug', {}, message)
}

/**
 * Adds an error issue annotation.
 *
 * @param {string | Error} message Error message.
 * @param {object} [properties] Optional annotation properties.
 */
export function error(message, properties = {}) {
  issueCommand(
    'error',
    toCommandProperties(properties),
    message instanceof Error ? message.toString() : message,
  )
}

/**
 * Escapes a workflow command message segment.
 *
 * @param {unknown} s Message value.
 *
 * @returns {string} Escaped message.
 */
export function escapeData(s) {
  return toCommandValue(s)
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A')
}

/**
 * Escapes a workflow command property value.
 *
 * @param {unknown} s Property value.
 *
 * @returns {string} Escaped property.
 */
export function escapeProperty(s) {
  return toCommandValue(s)
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A')
    .replace(/:/g, '%3A')
    .replace(/,/g, '%2C')
}

/**
 * Sets an env variable for this action and future actions in the job.
 *
 * @param {string} name Name of the variable to set.
 * @param {unknown} val Value of the variable (non-strings JSON.stringify'd).
 */
export function exportVariable(name, val) {
  const convertedVal = toCommandValue(val)
  process.env[name] = convertedVal
  const filePath = process.env['GITHUB_ENV'] || ''
  if (filePath) {
    issueFileCommand('ENV', prepareKeyValueMessage(name, val))
    return
  }
  issueCommand('set-env', { name }, convertedVal)
}

/**
 * Gets a boolean input per the YAML 1.2 "core schema" true/false sets
 * (`true | True | TRUE | false | False | FALSE`).
 *
 * @param {string} name Name of the input to get.
 * @param {{ required?: boolean; trimWhitespace?: boolean }} [options]
 *
 * @returns {boolean} The parsed boolean.
 */
export function getBooleanInput(name, options = {}) {
  const trueValue = ['true', 'True', 'TRUE']
  const falseValue = ['false', 'False', 'FALSE']
  const val = getInput(name, options)
  if (trueValue.includes(val)) {
    return true
  }
  if (falseValue.includes(val)) {
    return false
  }
  throw new TypeError(
    `Input does not meet YAML 1.2 "Core Schema" specification: ${name}\n` +
      `Support boolean input list: \`true | True | TRUE | false | False | FALSE\``,
  )
}

/**
 * Gets the value of an input from the `INPUT_<NAME>` environment variable.
 * Unless trimWhitespace is set to false in options, the value is trimmed.
 * Returns an empty string when the value is not defined.
 *
 * @param {string} name Name of the input to get.
 * @param {{ required?: boolean; trimWhitespace?: boolean }} [options]
 *
 * @returns {string} The input value.
 */
export function getInput(name, options = {}) {
  const opts = { __proto__: null, ...options }
  const val =
    process.env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`] || ''
  if (opts.required && !val) {
    throw new Error(`Input required and not supplied: ${name}`)
  }
  if (opts.trimWhitespace === false) {
    return val
  }
  return val.trim()
}

/**
 * Writes info to the log.
 *
 * @param {string} message Info message.
 */
export function info(message) {
  process.stdout.write(message + os.EOL)
}

/**
 * Whether the runner is in debug mode.
 *
 * @returns {boolean} True when step debug logging is on.
 */
export function isDebug() {
  return process.env['RUNNER_DEBUG'] === '1'
}

/**
 * Writes a `::name key=value,key=value::message` workflow command to stdout.
 *
 * @param {string} command Command name.
 * @param {object} properties Command properties. Falsy property values are
 *   skipped.
 * @param {unknown} message Command message.
 */
export function issueCommand(command, properties, message) {
  let cmdStr = `::${command || 'missing.command'}`
  const entries = Object.entries(properties).filter(([, val]) => val)
  if (entries.length > 0) {
    cmdStr += ' '
    cmdStr += entries
      .map(([key, val]) => `${key}=${escapeProperty(val)}`)
      .join(',')
  }
  cmdStr += `::${escapeData(message)}`
  process.stdout.write(cmdStr + os.EOL)
}

/**
 * Appends a message to the runner file backing a file command.
 *
 * @param {string} command File command name ('OUTPUT', 'ENV', 'PATH').
 * @param {unknown} message Line to append.
 */
export function issueFileCommand(command, message) {
  const filePath = process.env[`GITHUB_${command}`]
  if (!filePath) {
    throw new Error(
      `Unable to find environment variable for file command ${command}`,
    )
  }
  if (!existsSync(filePath)) {
    throw new Error(`Missing file at path: ${filePath}`)
  }
  appendFileSync(filePath, `${toCommandValue(message)}${os.EOL}`, {
    encoding: 'utf8',
  })
}

/**
 * Builds the `name<<DELIMITER … DELIMITER` heredoc payload for a key/value
 * file command, with a random delimiter so values can hold any content.
 *
 * @param {string} key Name of the output/variable.
 * @param {unknown} value Value to store.
 *
 * @returns {string} The heredoc-framed payload.
 */
export function prepareKeyValueMessage(key, value) {
  const delimiter = `ghadelimiter_${crypto.randomUUID()}`
  const convertedValue = toCommandValue(value)
  // These should realistically never happen, but just in case someone finds
  // a way to exploit uuid generation let's not allow keys or values that
  // contain the delimiter.
  if (key.includes(delimiter)) {
    throw new Error(
      `Unexpected input: name should not contain the delimiter "${delimiter}"`,
    )
  }
  if (convertedValue.includes(delimiter)) {
    throw new Error(
      `Unexpected input: value should not contain the delimiter "${delimiter}"`,
    )
  }
  return `${key}<<${delimiter}${os.EOL}${convertedValue}${os.EOL}${delimiter}`
}

/**
 * Sets the action status to failed; the action exits with code 1 without
 * terminating the process here.
 *
 * @param {string | Error} message Error issue message.
 */
export function setFailed(message) {
  process.exitCode = 1
  error(message)
}

/**
 * Sets the value of an output via the GITHUB_OUTPUT file, falling back to
 * the legacy `::set-output` command when the env var is absent.
 *
 * @param {string} name Name of the output to set.
 * @param {unknown} value Value to store (non-strings JSON.stringify'd).
 */
export function setOutput(name, value) {
  const filePath = process.env['GITHUB_OUTPUT'] || ''
  if (filePath) {
    issueFileCommand('OUTPUT', prepareKeyValueMessage(name, value))
    return
  }
  process.stdout.write(os.EOL)
  issueCommand('set-output', { name }, toCommandValue(value))
}

/**
 * Registers a secret that the runner masks from logs.
 *
 * @param {string} secret Value of the secret.
 */
export function setSecret(secret) {
  issueCommand('add-mask', {}, secret)
}

/**
 * Maps annotation properties onto the runner's command property names.
 *
 * @param {object} annotationProperties Annotation properties (title, file,
 *   startLine, endLine, startColumn, endColumn).
 *
 * @returns {object} Command properties keyed the way the runner expects.
 */
export function toCommandProperties(annotationProperties) {
  if (!Object.keys(annotationProperties).length) {
    return {}
  }
  return {
    title: annotationProperties.title,
    file: annotationProperties.file,
    line: annotationProperties.startLine,
    endLine: annotationProperties.endLine,
    col: annotationProperties.startColumn,
    endColumn: annotationProperties.endColumn,
  }
}

/**
 * Sanitizes an input into a string so it can be passed into a command safely.
 *
 * @param {unknown} input Input to sanitize into a string.
 *
 * @returns {string} The string form (JSON for non-strings, '' for nullish).
 */
export function toCommandValue(input) {
  if (input === null || input === undefined) {
    return ''
  }
  if (typeof input === 'string') {
    return input
  }
  return JSON.stringify(input)
}

/**
 * Adds a warning issue annotation.
 *
 * @param {string | Error} message Warning message.
 * @param {object} [properties] Optional annotation properties.
 */
export function warning(message, properties = {}) {
  issueCommand(
    'warning',
    toCommandProperties(properties),
    message instanceof Error ? message.toString() : message,
  )
}

/**
 * Buffered job-summary writer backed by the GITHUB_STEP_SUMMARY file.
 */
export class Summary {
  #buffer = ''
  #filePath

  /**
   * Finds the summary file path from the environment; rejects when the env
   * var is not found or the file is not readable/writable.
   *
   * @returns {Promise<string>} Step summary file path.
   */
  async filePath() {
    if (this.#filePath) {
      return this.#filePath
    }
    const pathFromEnv = process.env['GITHUB_STEP_SUMMARY']
    if (!pathFromEnv) {
      throw new Error(
        `Unable to find environment variable for $GITHUB_STEP_SUMMARY. Check if your runtime environment supports job summaries.`,
      )
    }
    if (!existsSync(pathFromEnv)) {
      throw new Error(
        `Unable to access summary file: '${pathFromEnv}'. Check if the file has correct read/write permissions.`,
      )
    }
    this.#filePath = pathFromEnv
    return this.#filePath
  }

  /**
   * Wraps content in an HTML tag, adding any HTML attributes.
   *
   * @param {string} tag HTML tag to wrap.
   * @param {string | null} content Content within the tag.
   * @param {object} [attrs] Key-value list of HTML attributes to add.
   *
   * @returns {string} Content wrapped in an HTML element.
   */
  wrap(tag, content, attrs = {}) {
    const htmlAttrs = Object.entries(attrs)
      .map(([key, value]) => ` ${key}="${value}"`)
      .join('')
    if (!content) {
      return `<${tag}${htmlAttrs}>`
    }
    return `<${tag}${htmlAttrs}>${content}</${tag}>`
  }

  /**
   * Writes the buffer to the summary file and empties the buffer. Appends
   * by default; `{ overwrite: true }` replaces the file.
   *
   * @param {{ overwrite?: boolean }} [options] Write options.
   *
   * @returns {Promise<Summary>} This instance.
   */
  async write(options = {}) {
    const opts = { __proto__: null, ...options }
    const overwrite = !!opts.overwrite
    const filePath = await this.filePath()
    const writeFunc = overwrite ? fs.writeFile : fs.appendFile
    await writeFunc(filePath, this.#buffer, { encoding: 'utf8' })
    return this.emptyBuffer()
  }

  /**
   * Returns the current summary buffer as a string.
   *
   * @returns {string} The buffer contents.
   */
  stringify() {
    return this.#buffer
  }

  /**
   * Resets the summary buffer without writing to the summary file.
   *
   * @returns {Summary} This instance.
   */
  emptyBuffer() {
    this.#buffer = ''
    return this
  }

  /**
   * Adds raw text to the summary buffer.
   *
   * @param {string} text Content to add.
   * @param {boolean} [addEOL] Append an EOL to the raw text (default false).
   *
   * @returns {Summary} This instance.
   */
  addRaw(text, addEOL = false) {
    this.#buffer += text
    return addEOL ? this.addEOL() : this
  }

  /**
   * Adds the operating system-specific end-of-line marker to the buffer.
   *
   * @returns {Summary} This instance.
   */
  addEOL() {
    return this.addRaw(os.EOL)
  }

  /**
   * Adds an HTML table to the summary buffer.
   *
   * @param {Array<
   *   Array<
   *     | string
   *     | {
   *         data: string
   *         header?: boolean
   *         colspan?: string
   *         rowspan?: string
   *       }
   *   >
   * >} rows
   *   Table rows.
   *
   * @returns {Summary} This instance.
   */
  addTable(rows) {
    const tableBody = rows
      .map(row => {
        const cells = row
          .map(cell => {
            if (typeof cell === 'string') {
              return this.wrap('td', cell)
            }
            const { colspan, data, header, rowspan } = cell
            const tag = header ? 'th' : 'td'
            const attrs = {
              ...(colspan && { colspan }),
              ...(rowspan && { rowspan }),
            }
            return this.wrap(tag, data, attrs)
          })
          .join('')
        return this.wrap('tr', cells)
      })
      .join('')
    const element = this.wrap('table', tableBody)
    return this.addRaw(element).addEOL()
  }
}

export const summary = new Summary()

export const core = {
  addPath,
  debug,
  error,
  exportVariable,
  getBooleanInput,
  getInput,
  info,
  isDebug,
  setFailed,
  setOutput,
  setSecret,
  summary,
  warning,
}
