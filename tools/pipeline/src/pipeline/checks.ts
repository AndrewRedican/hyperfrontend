/**
 * One check run per chain on the pull request: created when the chain's first task starts,
 * updated with its ended tasks as each one ends, and completed with the chain's conclusion, a
 * table of its tasks and the output of each failed one. A chain's requests go out one after
 * another, the completion always last. Best-effort: a refusal, such as a token without the
 * permission, disables the check runs after one notice; a request that got no answer or a server
 * error is retried when it is an update, and otherwise costs only that request, or that chain's
 * check run when it was the create. Nothing else depends on them. The ids are reported as they
 * are created and completed, so a run that is killed can still settle them. A check run whose
 * outcome is known the moment it exists, such as the plan, is created complete in one request, so
 * no cancel or lost answer between a create and its completion can leave it in progress; that
 * request is retried like an update, since a duplicate completed check run costs nothing.
 *
 * @module pipeline/checks
 */

import type { Chain, TaskResult } from './model'
import type { FetchLike, GitHubEnvironment } from './siblings'
import { createDate } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { fromEntries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { chainState, clip } from './live'
import { Outcome } from './model'
import { chainTable, failureLines } from './report'
import { githubHeaders } from './siblings'

/** What a check run shows. */
export interface CheckOutput {
  /** The title. */
  readonly title: string
  /** The Markdown summary. */
  readonly summary: string
  /** The machine-readable text, when there is one. */
  readonly text?: string
}

/** How many times an update or completion is sent before it is given up. */
export const CHECK_ATTEMPTS = 3

/** A check-run request GitHub answered with a refusal, which no retry changes. */
export class CheckRefusal extends Error {
  /** The status GitHub answered. */
  readonly status: number

  /**
   * A refusal named after the request.
   *
   * @param method - The HTTP method of the refused request
   * @param url - The address it was sent to
   * @param status - The status GitHub answered
   */
  constructor(method: string, url: string, status: number) {
    super(`${method} ${url} answered ${status}`)
    this.status = status
  }
}

/**
 * Waits before a retry.
 *
 * @param ms - How long
 * @returns Resolves after the wait
 */
function pause(ms: number): Promise<void> {
  return createPromise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/** The check-run endpoints the chains use. */
export interface CheckApi {
  /** Creates a check run in progress and returns its id. */
  create(name: string, headSha: string): Promise<number>
  /** Rewrites what a check run in progress shows. */
  update(id: number, output: CheckOutput): Promise<void>
  /** Completes a check run. */
  complete(id: number, conclusion: string, output: CheckOutput): Promise<void>
  /** Creates a check run already completed, in one request. */
  publish(name: string, headSha: string, conclusion: string, output: CheckOutput): Promise<void>
}

/** One check run the run created. */
export interface CheckRecord {
  /** The id. */
  readonly id: number
  /** Whether the run completed it. */
  readonly completed: boolean
}

/** The check runs of a run, by name. */
export type CheckRecords = Readonly<Record<string, CheckRecord>>

/** The hooks a run calls for its chains. */
export interface ChainChecks {
  /** Called when a chain's first task starts. */
  onStart(chain: Chain): Promise<void>
  /** Called when a task of a chain ends and others of the chain have not. */
  onTask(chain: Chain, results: readonly TaskResult[]): Promise<void>
  /** Called when every task of a chain has a result. */
  onEnd(chain: Chain, results: readonly TaskResult[]): Promise<void>
}

/** The requests of one chain's check run, sent one after another. */
interface ChainQueue {
  /** The last request queued; it answers the check run's id once it and every request before it are done. */
  tail: Promise<number>
  /** The state the queued update sends, or null when no update waits or the completion dropped it. */
  latest: CheckOutput | null
  /** What the hook of the queued update answered, until the update is sent. */
  queued: Promise<void> | null
  /** Whether the completion is queued. */
  ending: boolean
  /** Whether the create failed, which leaves the chain without a check run. */
  dead: boolean
}

/** The id a created check run answers with. */
interface Created {
  /** The id. */
  readonly id: number
}

/**
 * The check-run API of a repository.
 *
 * @param env - The GitHub environment
 * @param request - The request function
 * @param wait - Waits before a retry
 * @returns The API, or null when the environment lacks the token or repository
 */
export function githubChecks(env: GitHubEnvironment, request: FetchLike, wait: (ms: number) => Promise<void> = pause): CheckApi | null {
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repository } = env
  if (token === undefined || repository === undefined) return null
  const base = `${env.GITHUB_API_URL ?? 'https://api.github.com'}/repos/${repository}/check-runs`
  // why: a create sent twice can leave a second check run in progress that nothing completes, so an open create is sent once; a completed create and the idempotent PATCH are retried
  const send = async (url: string, method: string, body: unknown, retry: boolean, attempt = 1): Promise<string> => {
    try {
      const response = await request(url, { method, headers: githubHeaders(token), body: stringify(body) })
      if (response.ok) return response.text()
      if (response.status < 500) throw new CheckRefusal(method, url, response.status)
      throw createError(`${method} ${url} answered ${response.status}`)
    } catch (error) {
      if (error instanceof CheckRefusal || attempt >= (retry ? CHECK_ATTEMPTS : 1)) throw error
    }
    await wait(attempt * 1000)
    return send(url, method, body, retry, attempt + 1)
  }
  return {
    create: async (name, headSha) =>
      (
        parse(
          await send(base, 'POST', { name, head_sha: headSha, status: 'in_progress', started_at: createDate().toISOString() }, false)
        ) as Created
      ).id,
    update: async (id, output) => {
      await send(`${base}/${id}`, 'PATCH', { status: 'in_progress', output }, true)
    },
    complete: async (id, conclusion, output) => {
      await send(`${base}/${id}`, 'PATCH', { status: 'completed', conclusion, completed_at: createDate().toISOString(), output }, true)
    },
    publish: async (name, headSha, conclusion, output) => {
      const now = createDate().toISOString()
      await send(
        base,
        'POST',
        { name, head_sha: headSha, status: 'completed', conclusion, started_at: now, completed_at: now, output },
        true
      )
    },
  }
}

/**
 * The name of a chain's check run.
 *
 * @param chain - The chain the check run is for
 * @returns `<project> (<environment>)`
 */
export function checkName(chain: Chain): string {
  return `${chain.project} (${chain.environment})`
}

/**
 * The conclusion of a chain: failure when any task failed or was skipped behind a failure,
 * cancelled when a task was cancelled, else success.
 *
 * @param results - What every task of the chain ended as
 * @returns `failure`, `cancelled` or `success`
 */
export function chainConclusion(results: readonly TaskResult[]): string {
  if (results.some((result) => result.outcome === Outcome.Failure || result.outcome === Outcome.Skipped)) return 'failure'
  if (results.some((result) => result.outcome === Outcome.Cancelled)) return 'cancelled'
  return 'success'
}

/**
 * What a chain's check run shows for the tasks that ended.
 *
 * @param chain - The chain the check run is of
 * @param results - Its ended tasks
 * @param title - What the check run is headed
 * @returns The output, its text the chain's state as JSON
 */
export function chainOutput(chain: Chain, results: readonly TaskResult[], title: string): CheckOutput {
  const failures = failureLines(results)
  const lines = [...chainTable(chain, results), ...(failures.length === 0 ? [] : ['', ...failures])]
  return { title, summary: clip(lines.join('\n')), text: chainState(chain, results) }
}

/**
 * The hooks that keep one check run per chain. Each chain's requests wait for the one before
 * them, starting with the create: a hook called before the create has answered waits for it,
 * in-progress updates waiting behind a request collapse into the latest state, and an update
 * still waiting when the completion is queued is dropped, so the completion is the chain's last
 * request. Every hook answers once its request (or the request it collapsed into) is done.
 *
 * @param api - The check-run API
 * @param headSha - The commit the check runs are attached to
 * @param notice - Where the one notice goes when the API refuses
 * @param onRecords - Told the check runs by name whenever one is created or completed
 * @returns The hooks; after a refusal they do nothing
 */
export function chainChecks(
  api: Omit<CheckApi, 'publish'>,
  headSha: string,
  notice: (message: string) => void,
  onRecords: (records: CheckRecords) => void = () => undefined
): ChainChecks {
  const records = createMap<string, CheckRecord>()
  const queues = createMap<string, ChainQueue>()
  let enabled = true
  const publish = (): void => onRecords(fromEntries(records))
  const report = (error: unknown, name: string): void => {
    const message = error instanceof Error ? error.message : String(error)
    // why: several chains start at once, so the first refusal speaks and switches the rest off; anything else costs only its own request
    if (error instanceof CheckRefusal) {
      if (!enabled) return
      enabled = false
      notice(`check runs are off for this run: ${message}`)
    } else if (enabled) notice(`the check run of ${name} missed a request: ${message}`)
  }
  const open = (chain: Chain): ChainQueue | null => {
    const queue = queues.get(checkName(chain))
    return queue === undefined || queue.ending || queue.dead || !enabled ? null : queue
  }
  const enqueue = (queue: ChainQueue, name: string, request: (id: number) => Promise<void>): Promise<void> => {
    const previous = queue.tail
    const sent = previous.then(async (id) => {
      await request(id)
      return id
    })
    // why: a failed update must not hold back the chain's later requests, so the queue moves on from the id whatever the request did
    queue.tail = sent.catch(() => previous)
    // why: after a failed create the tail rejects with it, which the create already reported, so a tail nothing follows must not surface as unhandled
    queue.tail.catch(() => undefined)
    return sent.then(
      () => undefined,
      (error: unknown) => {
        // why: requests queued behind a create that failed fail with it, and the create already spoke
        if (!queue.dead) report(error, name)
      }
    )
  }
  return {
    onStart: async (chain) => {
      if (!enabled) return
      const name = checkName(chain)
      const created = api.create(name, headSha).then((id) => {
        records.set(name, { id, completed: false })
        publish()
        return id
      })
      const queue: ChainQueue = { tail: created, latest: null, queued: null, ending: false, dead: false }
      queues.set(name, queue)
      return created.then(
        () => undefined,
        (error: unknown) => {
          queue.dead = true
          report(error, name)
        }
      )
    },
    onTask: async (chain, results) => {
      const queue = open(chain)
      if (queue === null) return
      queue.latest = chainOutput(chain, results, `${results.length} of ${chain.tasks.length} tasks ended`)
      if (queue.queued !== null) return queue.queued
      queue.queued = enqueue(queue, checkName(chain), async (id) => {
        const output = queue.latest
        queue.latest = null
        queue.queued = null
        if (output !== null && enabled) await api.update(id, output)
      })
      return queue.queued
    },
    onEnd: async (chain, results) => {
      const queue = open(chain)
      if (queue === null) return
      queue.ending = true
      queue.latest = null
      const conclusion = chainConclusion(results)
      return enqueue(queue, checkName(chain), async (id) => {
        if (!enabled) return
        await api.complete(id, conclusion, chainOutput(chain, results, `${results.length} tasks, ${conclusion}`))
        records.set(checkName(chain), { id, completed: true })
        publish()
      })
    },
  }
}
