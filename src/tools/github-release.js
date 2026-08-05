/**
 * @file Minimal GitHub release-tag resolver — the whole slice of the
 *   `@actions/github` package this action ever consumed (one REST GET),
 *   re-homed on the lib's httpJson so the octokit/undici dependency tree
 *   stays out of the supply chain. Growth path: if the action ever needs
 *   more of the toolkit, port it as a wheelhouse upstream/* lockstep slice
 *   instead of re-adding the npm dependency.
 */

import { httpJson, HttpResponseError } from '@socketsecurity/lib/http-request'

/**
 * Resolves a release's tag_name via the GitHub REST API.
 *
 * @param {object} options
 * @param {string} options.owner Repository owner.
 * @param {string} options.repo Repository name.
 * @param {string} [options.tag] Explicit tag (e.g. 'v1.2.3'); the latest
 *   release when omitted.
 * @param {string} options.token Bearer token for api.github.com.
 *
 * @returns {Promise<string>} The release's tag_name
 */
export async function resolveReleaseTag({ owner, repo, tag, token }) {
  const endpoint = tag ? `releases/tags/${tag}` : 'releases/latest'
  const url = `https://api.github.com/repos/${owner}/${repo}/${endpoint}`
  let data
  try {
    data = await httpJson(url, {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'user-agent': 'Socket-GitHub-Action',
        'x-github-api-version': '2022-11-28',
      },
    })
  } catch (e) {
    // Re-shape onto the resolver's stable error contract: callers log
    // `error.status` / `error.url` without knowing the transport.
    const status =
      e instanceof HttpResponseError ? e.response.status : undefined
    const error = new Error(
      `GitHub API request failed${status ? ` (${status})` : ''} for ${url}`,
      { cause: e },
    )
    error.status = status
    error.url = url
    throw error
  }
  if (typeof data?.tag_name !== 'string') {
    const error = new Error(
      `GitHub API response for ${url} carries no tag_name`,
    )
    error.url = url
    throw error
  }
  return data.tag_name
}
