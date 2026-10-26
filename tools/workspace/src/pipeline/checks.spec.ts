import type { CheckApi } from './checks'
import type { Chain, TaskResult } from './model'
import type { FetchInit, FetchResponse } from './siblings'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { promiseAll } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { describe, expect, it } from '@hyperfrontend/testing'
import { chainChecks, chainConclusion, checkName, githubChecks } from './checks'

/** A chain of one build. */
const CHAIN: Chain = {
  project: 'lib-a',
  environment: 'linux',
  order: 0,
  tasks: [
    {
      id: 'lib-a:build',
      project: 'lib-a',
      target: 'build',
      environment: 'linux',
      needs: [],
      weight: 'heavy',
      reasons: [],
      command: [],
      env: {},
    },
  ],
}

/**
 * A result.
 *
 * @param outcome - How the build ended
 * @returns The result of the chain's build
 */
function result(outcome: TaskResult['outcome']): TaskResult {
  return {
    id: 'lib-a:build',
    project: 'lib-a',
    target: 'build',
    environment: 'linux',
    reasons: [],
    outcome,
    exitCode: 0,
    detail: null,
    startedAt: 0,
    endedAt: 1000,
    durationMs: 1000,
    log: null,
  }
}

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
})

describe('checkName', () => {
  it('names the project and the environment', () => {
    expect(checkName(CHAIN)).toBe('lib-a (linux)')
  })
})

describe('chainConclusion', () => {
  it.each([
    [[result('success')], 'success'],
    [[result('success'), result('failure')], 'failure'],
    [[result('skipped')], 'failure'],
    [[result('success'), result('cancelled')], 'cancelled'],
  ])('concludes %j as %s', (results, conclusion) => {
    expect(chainConclusion(results)).toBe(conclusion)
  })
})

describe('chainChecks', () => {
  /**
   * An API recording its calls.
   *
   * @param failing - Whether every call fails
   * @returns The API and the calls
   */
  function recording(failing = false): { api: CheckApi; calls: unknown[] } {
    const calls: unknown[] = []
    return {
      calls,
      api: {
        create: async (name, headSha) => {
          if (failing) throw new Error('forbidden')
          calls.push(['create', name, headSha])
          return 9
        },
        complete: async (id, conclusion, output) => {
          calls.push(['complete', id, conclusion, output.title])
        },
      },
    }
  }

  it('creates the check run as the chain starts and completes it as the chain ends', async () => {
    const { api, calls } = recording()
    const hooks = chainChecks(api, 'abc', () => undefined)
    await hooks.onStart(CHAIN)
    await hooks.onEnd(CHAIN, [result('success')])
    expect(calls).toEqual([
      ['create', 'lib-a (linux)', 'abc'],
      ['complete', 9, 'success', '1 tasks, success'],
    ])
  })

  it('completes nothing for a chain that never started', async () => {
    const { api, calls } = recording()
    await chainChecks(api, 'abc', () => undefined).onEnd(CHAIN, [result('success')])
    expect(calls).toEqual([])
  })

  it('switches off after one refusal, with one notice', async () => {
    const notices: string[] = []
    const { api, calls } = recording(true)
    const hooks = chainChecks(api, 'abc', (message) => notices.push(message))
    await hooks.onStart(CHAIN)
    await hooks.onStart({ ...CHAIN, project: 'lib-b' })
    await hooks.onEnd(CHAIN, [result('success')])
    expect({ notices, calls }).toEqual({ notices: ['check runs are off for this run: forbidden'], calls: [] })
  })

  it('speaks once when several chains are refused at the same time', async () => {
    const notices: string[] = []
    const { api } = recording(true)
    const hooks = chainChecks(api, 'abc', (message) => notices.push(message))
    await promiseAll([hooks.onStart(CHAIN), hooks.onStart({ ...CHAIN, project: 'lib-b' })])
    expect(notices).toEqual(['check runs are off for this run: forbidden'])
  })

  it('describes a refusal that is not an error', async () => {
    const notices: string[] = []
    const hooks = chainChecks({ create: async () => Promise.reject('nope'), complete: async () => undefined }, 'abc', (message) =>
      notices.push(message)
    )
    await hooks.onStart(CHAIN)
    expect(notices).toEqual(['check runs are off for this run: nope'])
  })
})
