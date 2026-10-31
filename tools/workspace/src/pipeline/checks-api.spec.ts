import type { FetchInit, FetchResponse } from './siblings'
import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { describe, expect, it } from '@hyperfrontend/testing'
import { CHECK_ATTEMPTS, CheckRefusal, githubChecks } from './checks'

/**
 * A response.
 *
 * @param status - The status code
 * @param body - What the response carries
 * @returns The response
 */
function respond(status: number, body: unknown): FetchResponse {
  return { ok: status < 300, status, text: async () => stringify(body) }
}

describe('githubChecks', () => {
  it('answers null without the token or the repository', () => {
    expect(githubChecks({ GITHUB_TOKEN: 't' }, async () => respond(200, {}))).toBeNull()
  })

  it('creates a check run in progress on the head', async () => {
    const seen: [string, FetchInit][] = []
    const api = githubChecks({ GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'o/r' }, async (url: string, init: FetchInit) => {
      seen.push([url, init])
      return respond(201, { id: 7 })
    })
    const id = await api?.create('lib-a (linux)', 'abc')
    const [url, init] = seen[0] as [string, FetchInit]
    expect({ id, url, method: init.method, body: parse(init.body ?? '') }).toEqual({
      id: 7,
      url: 'https://api.github.com/repos/o/r/check-runs',
      method: 'POST',
      body: expect.objectContaining({ name: 'lib-a (linux)', head_sha: 'abc', status: 'in_progress' }),
    })
  })

  it('rewrites what a check run in progress shows', async () => {
    const seen: [string, FetchInit][] = []
    const api = githubChecks({ GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'o/r' }, async (url: string, init: FetchInit) => {
      seen.push([url, init])
      return respond(200, {})
    })
    await api?.update(7, { title: 'one of two', summary: 'table', text: '{}' })
    const [url, init] = seen[0] as [string, FetchInit]
    expect({ url, method: init.method, body: parse(init.body ?? '') }).toEqual({
      url: 'https://api.github.com/repos/o/r/check-runs/7',
      method: 'PATCH',
      body: { status: 'in_progress', output: { title: 'one of two', summary: 'table', text: '{}' } },
    })
  })

  it('completes a check run with its conclusion and output', async () => {
    const seen: [string, FetchInit][] = []
    const api = githubChecks(
      { GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'o/r', GITHUB_API_URL: 'https://api.example' },
      async (url: string, init: FetchInit) => {
        seen.push([url, init])
        return respond(200, {})
      }
    )
    await api?.complete(7, 'success', { title: 'done', summary: 'table' })
    const [url, init] = seen[0] as [string, FetchInit]
    expect({ url, method: init.method, body: parse(init.body ?? '') }).toEqual({
      url: 'https://api.example/repos/o/r/check-runs/7',
      method: 'PATCH',
      body: expect.objectContaining({ status: 'completed', conclusion: 'success', output: { title: 'done', summary: 'table' } }),
    })
  })

  it('fails on a refused request', async () => {
    const api = githubChecks({ GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'o/r' }, async () => respond(403, {}))
    await expect(api?.create('lib-a (linux)', 'abc')).rejects.toThrow('POST https://api.github.com/repos/o/r/check-runs answered 403')
  })

  it('never retries a refusal', async () => {
    const waits: number[] = []
    const api = githubChecks(
      { GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'o/r' },
      async () => respond(422, {}),
      async (ms) => {
        waits.push(ms)
      }
    )
    const failure = await api?.update(7, { title: 't', summary: 's' }).then(
      () => null,
      (error: unknown) => error
    )
    expect({ refusal: failure instanceof CheckRefusal, status: (failure as CheckRefusal).status, waits }).toEqual({
      refusal: true,
      status: 422,
      waits: [],
    })
  })

  it('retries an update that got no answer, then sends it', async () => {
    const waits: number[] = []
    let calls = 0
    const api = githubChecks(
      { GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'o/r' },
      async () => {
        calls += 1
        if (calls === 1) throw new Error('fetch failed')
        return respond(200, {})
      },
      async (ms) => {
        waits.push(ms)
      }
    )
    await api?.update(7, { title: 't', summary: 's' })
    expect({ calls, waits }).toEqual({ calls: 2, waits: [1000] })
  })

  it('gives a completion up after the last server error, as no refusal', async () => {
    const waits: number[] = []
    let calls = 0
    const api = githubChecks(
      { GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'o/r' },
      async () => {
        calls += 1
        return respond(503, {})
      },
      async (ms) => {
        waits.push(ms)
      }
    )
    const failure = await api?.complete(7, 'success', { title: 't', summary: 's' }).then(
      () => null,
      (error: unknown) => error
    )
    expect({ calls, waits, refusal: failure instanceof CheckRefusal, message: (failure as Error).message }).toEqual({
      calls: CHECK_ATTEMPTS,
      waits: [1000, 2000],
      refusal: false,
      message: 'PATCH https://api.github.com/repos/o/r/check-runs/7 answered 503',
    })
  })

  it('sends a create once, whatever the answer', async () => {
    let calls = 0
    const api = githubChecks(
      { GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'o/r' },
      async () => {
        calls += 1
        throw new Error('fetch failed')
      },
      async () => undefined
    )
    const failure = await api?.create('lib-a (linux)', 'abc').then(
      () => null,
      (error: unknown) => error
    )
    expect({ message: (failure as Error).message, calls }).toEqual({ message: 'fetch failed', calls: 1 })
  })

  it('waits a second before retrying by default', async () => {
    let calls = 0
    const api = githubChecks({ GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'o/r' }, async () => {
      calls += 1
      return calls === 1 ? respond(502, {}) : respond(200, {})
    })
    const started = dateNow()
    await api?.update(7, { title: 't', summary: 's' })
    expect(dateNow() - started).toBeGreaterThanOrEqual(900)
  })
})
