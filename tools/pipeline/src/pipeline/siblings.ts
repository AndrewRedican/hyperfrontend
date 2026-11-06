/**
 * Waits for a sibling job of the same workflow run to conclude, by polling the run's job list
 * through the GitHub API: the Linux environment waits for the Windows and macOS ones before it publishes.
 *
 * @module pipeline/siblings
 */

import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { PipelineRule } from './model'

/** One job of a run, as far as the wait reads it. */
export interface JobStatus {
  /** The job's name as the workflow shows it. */
  readonly name: string
  /** `queued`, `in_progress` or `completed`. */
  readonly status: string
  /** The conclusion once completed, else null. */
  readonly conclusion: string | null
}

/** Lists the jobs of the run. */
export type FetchJobs = () => Promise<readonly JobStatus[]>

/** The outcomes of a wait beyond the job's own conclusion. */
export const WaitOutcome = freeze({
  /** The job had not concluded within the time limit. */
  Timeout: 'timeout',
  /** The run has no job of that name. */
  Absent: 'absent',
} as const)

/** How a wait runs. */
export interface WaitOptions {
  /** Lists the jobs. */
  readonly fetchJobs: FetchJobs
  /** The job waited for. */
  readonly name: string
  /** How long to wait at most, in milliseconds. */
  readonly timeoutMs: number
  /** How long between two polls, in milliseconds. */
  readonly intervalMs: number
  /** Pauses; a timer unless a test supplies another. */
  readonly sleep?: (ms: number) => Promise<void>
  /** The clock. */
  readonly now?: () => number
}

/** The smallest slice of a fetch response the readers use. */
export interface FetchResponse {
  /** Whether the status is 2xx. */
  readonly ok: boolean
  /** The status code. */
  readonly status: number
  /** The body as text. */
  text(): Promise<string>
}

/** What a request carries. */
export interface FetchInit {
  /** The method; GET when absent. */
  readonly method?: string
  /** The headers. */
  readonly headers: Readonly<Record<string, string>>
  /** The body. */
  readonly body?: string
}

/** Performs one request; `fetch` unless a test supplies another. */
export type FetchLike = (url: string, init: FetchInit) => Promise<FetchResponse>

/** The GitHub environment the readers need. */
export interface GitHubEnvironment {
  /** The token. */
  readonly GITHUB_TOKEN?: string
  /** `owner/repo`. */
  readonly GITHUB_REPOSITORY?: string
  /** The API root. */
  readonly GITHUB_API_URL?: string
  /** The run id. */
  readonly GITHUB_RUN_ID?: string
}

/** One page of the jobs endpoint, as far as it is read. */
interface JobsPage {
  /** How many jobs the run has. */
  readonly total_count: number
  /** The jobs of the page. */
  readonly jobs: readonly JobStatus[]
}

/** How many jobs one page holds. */
const PAGE_SIZE = 100

/**
 * Pauses for a while.
 *
 * @param ms - How long, in milliseconds
 * @returns Resolves after the pause
 */
export function pause(ms: number): Promise<void> {
  return createPromise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * The headers of a GitHub API request.
 *
 * @param token - The GitHub token
 * @returns The accept, authorization, content-type and API-version headers
 */
export function githubHeaders(token: string): Record<string, string> {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'x-github-api-version': '2022-11-28',
  }
}

/**
 * A lister of the current run's jobs through the GitHub API.
 *
 * @param env - The GitHub environment
 * @param request - The request function
 * @returns The lister, or null when the environment lacks the token, repository or run id
 */
export function githubJobs(env: GitHubEnvironment, request: FetchLike): FetchJobs | null {
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repository, GITHUB_RUN_ID: run } = env
  if (token === undefined || repository === undefined || run === undefined) return null
  const api = env.GITHUB_API_URL ?? 'https://api.github.com'
  return async () => {
    const jobs: JobStatus[] = []
    for (let page = 1; ; page += 1) {
      const response = await request(`${api}/repos/${repository}/actions/runs/${run}/jobs?per_page=${PAGE_SIZE}&page=${page}`, {
        headers: githubHeaders(token),
      })
      if (!response.ok) throw createError(`listing the run's jobs answered ${response.status}`)
      const body = parse(await response.text()) as JobsPage
      jobs.push(...body.jobs.map((job) => ({ name: job.name, status: job.status, conclusion: job.conclusion })))
      if (jobs.length >= body.total_count || body.jobs.length === 0) return jobs
    }
  }
}

/**
 * Waits until a job of the run concludes. A poll that fails counts as an unfinished job, so the
 * wait polls again until the deadline.
 *
 * @param options - The lister, the name, the limits and the clock
 * @returns The job's conclusion, `timeout` or `absent`
 * @throws {Error} The last poll's error, when that poll failed at or past the deadline
 */
export async function waitForJob(options: WaitOptions): Promise<string> {
  const now = options.now ?? dateNow
  const sleep = options.sleep ?? pause
  const deadline = now() + options.timeoutMs
  for (;;) {
    try {
      const job = (await options.fetchJobs()).find((item) => item.name === options.name)
      if (job === undefined) return WaitOutcome.Absent
      if (job.status === 'completed') return job.conclusion ?? 'unknown'
      if (now() >= deadline) return WaitOutcome.Timeout
    } catch (error) {
      if (now() >= deadline) throw error
    }
    await sleep(options.intervalMs)
  }
}

/** How the publish gate waits for the sibling job. */
export interface GateOptions extends Omit<WaitOptions, 'fetchJobs' | 'name'> {
  /** The job the publishes wait for. */
  readonly name: string
  /** Lists the jobs, or null when the environment cannot ask. */
  readonly fetchJobs: FetchJobs | null
}

/**
 * The gate the publishes wait at: the sibling job's conclusion, asked for once however many
 * publishes wait. It closes when the job did not succeed, did not conclude in time, or could
 * not be asked about.
 *
 * @param options - The job, the lister, the limits and the clock
 * @returns A function answering why the publishes must not run, or null when they may; it never rejects
 */
export function siblingGate(options: GateOptions): () => Promise<string | null> {
  const { name, fetchJobs } = options
  let pending: Promise<string | null> | null = null
  return async () => {
    if (fetchJobs === null) return `${PipelineRule.SiblingEnvironment}: no GitHub token to ask about ${name}`
    pending ??= waitForJob({ ...options, name, fetchJobs }).then(
      (conclusion) => (conclusion === 'success' ? null : `${PipelineRule.SiblingEnvironment}: ${name} concluded ${conclusion}`),
      (error: unknown) =>
        `${PipelineRule.SiblingEnvironment}: asking about ${name} failed: ${error instanceof Error ? error.message : String(error)}`
    )
    return pending
  }
}
