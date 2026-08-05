// The inlined GitHub release-tag resolver (src/tools/github-release.js) — the
// slice of @actions/github this action consumed, re-homed on the lib's
// httpJson. All cases mock the http-request module; no network.

import assert from 'node:assert/strict'

import { beforeEach, describe, expect, test, vi } from 'vitest'

const state = vi.hoisted(() => ({
  calls: [] as Array<{ options: Record<string, unknown>; url: string }>,
  reject: undefined as unknown,
  respond: undefined as unknown,
}))

class FakeHttpResponseError extends Error {
  response: { status: number }
  constructor(status: number) {
    super(`HTTP ${status}`)
    this.response = { status }
  }
}

vi.mock(import('@socketsecurity/lib/http-request'), () => ({
  HttpResponseError: FakeHttpResponseError,
  httpJson: vi.fn(async (url: string, options: Record<string, unknown>) => {
    state.calls.push({ options, url })
    if (state.reject !== undefined) {
      throw state.reject
    }
    return state.respond
  }),
}))

const { resolveReleaseTag } =
  await import('../../../src/tools/github-release.js')

beforeEach(() => {
  state.calls = []
  state.reject = undefined
  state.respond = undefined
})

describe('resolveReleaseTag', () => {
  test('resolves the latest release when no tag is given', async () => {
    state.respond = { tag_name: 'v1.2.3' }
    const tag = await resolveReleaseTag({
      owner: 'acme',
      repo: 'widgets',
      token: 'tkn',
    })
    assert.equal(tag, 'v1.2.3')
    const call = state.calls[0]!
    assert.equal(
      call.url,
      'https://api.github.com/repos/acme/widgets/releases/latest',
    )
    const headers = call.options['headers'] as Record<string, string>
    assert.equal(headers.authorization, 'Bearer tkn')
    assert.equal(headers['user-agent'], 'Socket-GitHub-Action')
  })

  test('resolves an explicit tag through the tags endpoint', async () => {
    state.respond = { tag_name: 'v0.9.0' }
    const tag = await resolveReleaseTag({
      owner: 'acme',
      repo: 'widgets',
      tag: 'v0.9.0',
      token: 'tkn',
    })
    assert.equal(tag, 'v0.9.0')
    assert.equal(
      state.calls[0]!.url,
      'https://api.github.com/repos/acme/widgets/releases/tags/v0.9.0',
    )
  })

  test('a transport error re-shapes onto the status/url contract', async () => {
    state.reject = new FakeHttpResponseError(404)
    await expect(
      resolveReleaseTag({
        owner: 'acme',
        repo: 'widgets',
        tag: 'v9.9.9',
        token: 'tkn',
      }),
    ).rejects.toMatchObject({
      status: 404,
      url: 'https://api.github.com/repos/acme/widgets/releases/tags/v9.9.9',
    })
  })

  test('a 2xx response without a tag_name throws rather than returning undefined', async () => {
    state.respond = { message: 'shape drift' }
    await expect(
      resolveReleaseTag({ owner: 'acme', repo: 'widgets', token: 'tkn' }),
    ).rejects.toThrow(/carries no tag_name/)
  })
})
