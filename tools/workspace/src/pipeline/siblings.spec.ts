import type { FetchInit, FetchResponse, JobStatus } from './siblings'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { describe, expect, it } from '@hyperfrontend/testing'
import { githubHeaders, githubJobs, pause, waitForJob } from './siblings'

/**
 * A job list answering one status per poll.
 *
 * @param polls - The job as each poll sees it; the last repeats
 * @returns The lister and the polls made so far
 */
function polling(polls: readonly (readonly JobStatus[])[]): { fetchJobs: () => Promise<readonly JobStatus[]>; count: () => number } {
  let count = 0
  return {
    fetchJobs: async () => {
      const jobs = polls[count] ?? (polls[polls.length - 1] as readonly JobStatus[])
      count += 1
      return jobs
    },
    count: () => count,
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

describe('waitForJob', () => {
  it('answers the conclusion of a completed job at once', async () => {
    const { fetchJobs } = polling([[{ name: 'environment (windows)', status: 'completed', conclusion: 'success' }]])
    expect(await waitForJob({ fetchJobs, name: 'environment (windows)', timeoutMs: 1000, intervalMs: 1, now: () => 0 })).toBe('success')
  })

  it('polls until the job completes', async () => {
    const queued: JobStatus = { name: 'environment (windows)', status: 'queued', conclusion: null }
    const lister = polling([[queued], [{ ...queued, status: 'in_progress' }], [{ ...queued, status: 'completed', conclusion: 'failure' }]])
    const slept: number[] = []
    const conclusion = await waitForJob({
      fetchJobs: lister.fetchJobs,
      name: 'environment (windows)',
      timeoutMs: 1000,
      intervalMs: 7,
      now: () => 0,
      sleep: async (ms) => void slept.push(ms),
    })
    expect({ conclusion, polls: lister.count(), slept }).toEqual({ conclusion: 'failure', polls: 3, slept: [7, 7] })
  })

  it('gives up at the deadline', async () => {
    const { fetchJobs } = polling([[{ name: 'environment (windows)', status: 'in_progress', conclusion: null }]])
    let clock = 0
    const conclusion = await waitForJob({
      fetchJobs,
      name: 'environment (windows)',
      timeoutMs: 100,
      intervalMs: 1,
      now: () => (clock += 60),
      sleep: async () => undefined,
    })
    expect(conclusion).toBe('timeout')
  })

  it('answers absent when the run has no such job', async () => {
    const { fetchJobs } = polling([[{ name: 'plan', status: 'completed', conclusion: 'success' }]])
    expect(await waitForJob({ fetchJobs, name: 'environment (windows)', timeoutMs: 100, intervalMs: 1, now: () => 0 })).toBe('absent')
  })

  it('answers unknown for a completed job without a conclusion', async () => {
    const { fetchJobs } = polling([[{ name: 'environment (windows)', status: 'completed', conclusion: null }]])
    expect(await waitForJob({ fetchJobs, name: 'environment (windows)', timeoutMs: 100, intervalMs: 1, now: () => 0 })).toBe('unknown')
  })

  it('pauses with a timer by default', async () => {
    const { fetchJobs } = polling([
      [{ name: 'j', status: 'queued', conclusion: null }],
      [{ name: 'j', status: 'completed', conclusion: 'success' }],
    ])
    expect(await waitForJob({ fetchJobs, name: 'j', timeoutMs: 1000, intervalMs: 1 })).toBe('success')
  })
})

describe('pause', () => {
  it('resolves after the time', async () => {
    await expect(pause(1)).resolves.toBeUndefined()
  })
})

describe('githubHeaders', () => {
  it('carries the token and the API version', () => {
    expect(githubHeaders('t0k')).toEqual({
      accept: 'application/vnd.github+json',
      authorization: 'Bearer t0k',
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
    })
  })
})

describe('githubJobs', () => {
  const env = { GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'o/r', GITHUB_RUN_ID: '42', GITHUB_API_URL: 'https://api.example' }

  it('answers null without the token, the repository or the run', () => {
    expect([
      githubJobs({}, async () => respond(200, {})),
      githubJobs({ ...env, GITHUB_RUN_ID: undefined }, async () => respond(200, {})),
    ]).toEqual([null, null])
  })

  it('lists the jobs of the run across pages', async () => {
    const requests: string[] = []
    const pages: Record<string, unknown> = {
      'https://api.example/repos/o/r/actions/runs/42/jobs?per_page=100&page=1': {
        total_count: 2,
        jobs: [{ name: 'a', status: 'completed', conclusion: 'success', extra: 1 }],
      },
      'https://api.example/repos/o/r/actions/runs/42/jobs?per_page=100&page=2': {
        total_count: 2,
        jobs: [{ name: 'b', status: 'queued', conclusion: null }],
      },
    }
    const list = githubJobs(env, async (url: string) => {
      requests.push(url)
      return respond(200, pages[url])
    })
    expect({ jobs: await list?.(), requests: requests.length }).toEqual({
      jobs: [
        { name: 'a', status: 'completed', conclusion: 'success' },
        { name: 'b', status: 'queued', conclusion: null },
      ],
      requests: 2,
    })
  })

  it('stops on an empty page', async () => {
    const list = githubJobs(env, async () => respond(200, { total_count: 5, jobs: [] }))
    expect(await list?.()).toEqual([])
  })

  it('reaches api.github.com by default, with the token', async () => {
    const seen: [string, FetchInit][] = []
    const list = githubJobs({ ...env, GITHUB_API_URL: undefined }, async (url: string, init: FetchInit) => {
      seen.push([url, init])
      return respond(200, { total_count: 0, jobs: [] })
    })
    await list?.()
    expect(seen).toEqual([['https://api.github.com/repos/o/r/actions/runs/42/jobs?per_page=100&page=1', { headers: githubHeaders('t') }]])
  })

  it('fails on a refused request', async () => {
    const list = githubJobs(env, async () => respond(403, {}))
    await expect(list?.()).rejects.toThrow("listing the run's jobs answered 403")
  })
})
