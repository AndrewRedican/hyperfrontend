/**
 * One check run per chain on the pull request: created when the chain's first task starts,
 * updated with its ended tasks as each one ends, and completed with the chain's conclusion and a
 * table of its tasks. Best-effort: a token without the permission disables the check runs after
 * one notice, and nothing else depends on them. The ids are reported as they are created and
 * completed, so a run that is killed can still settle them.
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
import { chainState } from './live'
import { Outcome } from './model'
import { chainTable } from './report'
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

/** The check-run endpoints the chains use. */
export interface CheckApi {
  /** Creates a check run in progress and returns its id. */
  create(name: string, headSha: string): Promise<number>
  /** Rewrites what a check run in progress shows. */
  update(id: number, output: CheckOutput): Promise<void>
  /** Completes a check run. */
  complete(id: number, conclusion: string, output: CheckOutput): Promise<void>
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
 * @returns The API, or null when the environment lacks the token or repository
 */
export function githubChecks(env: GitHubEnvironment, request: FetchLike): CheckApi | null {
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repository } = env
  if (token === undefined || repository === undefined) return null
  const base = `${env.GITHUB_API_URL ?? 'https://api.github.com'}/repos/${repository}/check-runs`
  const send = async (url: string, method: string, body: unknown): Promise<string> => {
    const response = await request(url, { method, headers: githubHeaders(token), body: stringify(body) })
    if (!response.ok) throw createError(`${method} ${url} answered ${response.status}`)
    return response.text()
  }
  return {
    create: async (name, headSha) =>
      (
        parse(
          await send(base, 'POST', { name, head_sha: headSha, status: 'in_progress', started_at: createDate().toISOString() })
        ) as Created
      ).id,
    update: async (id, output) => {
      await send(`${base}/${id}`, 'PATCH', { status: 'in_progress', output })
    },
    complete: async (id, conclusion, output) => {
      await send(`${base}/${id}`, 'PATCH', { status: 'completed', conclusion, completed_at: createDate().toISOString(), output })
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
  return { title, summary: chainTable(chain, results).join('\n'), text: chainState(chain, results) }
}

/**
 * The hooks that keep one check run per chain.
 *
 * @param api - The check-run API
 * @param headSha - The commit the check runs are attached to
 * @param notice - Where the one notice goes when the API refuses
 * @param onRecords - Told the check runs by name whenever one is created or completed
 * @returns The hooks; after a refusal they do nothing
 */
export function chainChecks(
  api: CheckApi,
  headSha: string,
  notice: (message: string) => void,
  onRecords: (records: CheckRecords) => void = () => undefined
): ChainChecks {
  const records = createMap<string, CheckRecord>()
  let enabled = true
  const publish = (): void => onRecords(fromEntries(records))
  const attempt = async (action: () => Promise<void>): Promise<void> => {
    if (!enabled) return
    try {
      await action()
    } catch (error) {
      // why: several chains start at once, so their refusals arrive together; the first one speaks and switches the rest off.
      if (!enabled) return
      enabled = false
      notice(`check runs are off for this run: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return {
    onStart: (chain) =>
      attempt(async () => {
        records.set(checkName(chain), { id: await api.create(checkName(chain), headSha), completed: false })
        publish()
      }),
    onTask: (chain, results) =>
      attempt(async () => {
        const record = records.get(checkName(chain))
        if (record === undefined) return
        await api.update(record.id, chainOutput(chain, results, `${results.length} of ${chain.tasks.length} tasks ended`))
      }),
    onEnd: (chain, results) =>
      attempt(async () => {
        const record = records.get(checkName(chain))
        if (record === undefined) return
        const conclusion = chainConclusion(results)
        await api.complete(record.id, conclusion, chainOutput(chain, results, `${results.length} tasks, ${conclusion}`))
        records.set(checkName(chain), { id: record.id, completed: true })
        publish()
      }),
  }
}
