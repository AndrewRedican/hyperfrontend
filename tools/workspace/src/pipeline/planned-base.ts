/**
 * The base a push to main is planned from: the newest first-parent ancestor of the head whose
 * main run published its plan. A push whose run was cancelled while it waited, or whose plan
 * failed, planned nothing, so its changes are planned again by the next push that is planned.
 *
 * @module pipeline/planned-base
 */

import type { FetchLike, GitHubEnvironment } from './siblings'
import { execFileSync } from 'node:child_process'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { PLAN_CHECK_NAME } from './live'
import { githubHeaders } from './siblings'

/** How many first parents the walk asks about before it gives up and plans everything. */
export const PLANNED_BASE_DEPTH = 50

/** How the walk reads the history and the check runs. */
export interface PlannedBaseOptions {
  /** The first-parent ancestors of the head, newest first, the head left out, at most `depth` of them. */
  readonly listFirstParents: (depth: number) => readonly string[]
  /** Whether a commit's main run published its plan. */
  readonly isPlanned: (sha: string) => Promise<boolean>
  /** How many ancestors are asked about at most. */
  readonly depth: number
}

/** What a listed check run shows, as far as it is read. */
interface ListedOutput {
  /** The machine-readable text, when there is one. */
  readonly text?: string | null
}

/** One check run of the list endpoint, as far as it is read. */
interface ListedCheckRun {
  /** The conclusion once completed, else null. */
  readonly conclusion: string | null
  /** What the check run shows. */
  readonly output?: ListedOutput
}

/** The part of the compact plan the walk reads. */
interface PublishedPlan {
  /** Whether the plan publishes, which only a main run's does. */
  readonly main?: unknown
}

/** Where the planned base is looked for and where the walk reports. */
export interface ResolveOptions {
  /** The workspace root, absolute. */
  readonly root: string
  /** The GitHub environment. */
  readonly env: GitHubEnvironment
  /** The request function. */
  readonly request: FetchLike
  /** Receives one line saying which base was taken, or why everything is planned. */
  readonly report: (line: string) => void
}

/** One page of the list endpoint, as far as it is read. */
interface CheckRunsPage {
  /** The check runs. */
  readonly check_runs: readonly ListedCheckRun[]
}

/**
 * The newest first-parent ancestor of the head that was planned.
 *
 * @param options - The history, the check-run lookup and the bound
 * @returns The ancestor's sha, or null when none within the bound was planned
 */
export async function plannedBase(options: PlannedBaseOptions): Promise<string | null> {
  for (const sha of options.listFirstParents(options.depth).slice(0, options.depth)) {
    if (await options.isPlanned(sha)) return sha
  }
  return null
}

/**
 * Whether a check run is a completed main plan: a pull request publishes its plan under the same
 * name, and a commit planned only there ran nothing on main.
 *
 * @param run - The check run
 * @returns True for a successful plan whose compact plan publishes
 */
function isMainPlan(run: ListedCheckRun): boolean {
  if (run.conclusion !== 'success') return false
  try {
    return (parse(run.output?.text ?? '') as PublishedPlan).main === true
  } catch {
    return false
  }
}

/**
 * Whether a commit was planned by a main run, through the GitHub API.
 *
 * @param env - The GitHub environment
 * @param request - The request function
 * @returns The lookup, or null when the environment lacks the token or repository
 */
export function githubPlanned(env: GitHubEnvironment, request: FetchLike): ((sha: string) => Promise<boolean>) | null {
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repository } = env
  if (token === undefined || repository === undefined) return null
  const base = `${env.GITHUB_API_URL ?? 'https://api.github.com'}/repos/${repository}/commits`
  return async (sha) => {
    const url = `${base}/${sha}/check-runs?check_name=${encodeURIComponent(PLAN_CHECK_NAME)}&status=completed`
    const response = await request(url, { headers: githubHeaders(token) })
    if (!response.ok) throw createError(`GET ${url} answered ${response.status}`)
    return (parse(await response.text()) as CheckRunsPage).check_runs.some(isMainPlan)
  }
}

/**
 * The first-parent ancestors of the head of a repository, newest first, the head left out.
 *
 * @param root - The repository root, absolute
 * @param depth - How many at most
 * @returns The shas, none when the head has no parent
 */
export function firstParents(root: string, depth: number): string[] {
  try {
    const listed = execFileSync('git', ['rev-list', '--first-parent', `--max-count=${depth}`, 'HEAD~1'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return listed.split(/\r?\n/).filter((line) => line !== '')
  } catch {
    return []
  }
}

/**
 * The newest first-parent ancestor of the head a main run planned, or null to plan everything.
 *
 * @param options - The repository, the GitHub environment and where the outcome is reported
 * @returns The ancestor's sha, or null when none is found within the bound or the check runs cannot be read
 */
export async function resolvePlannedBase(options: ResolveOptions): Promise<string | null> {
  const isPlanned = githubPlanned(options.env, options.request)
  if (isPlanned === null) {
    options.report('no GitHub token or repository to find the planned base with: planning everything')
    return null
  }
  try {
    const found = await plannedBase({
      listFirstParents: (depth) => firstParents(options.root, depth),
      isPlanned,
      depth: PLANNED_BASE_DEPTH,
    })
    options.report(
      found === null
        ? `none of the ${PLANNED_BASE_DEPTH} first parents before HEAD was planned: planning everything`
        : `planning from ${found}, the newest first parent a run planned`
    )
    return found
  } catch (error) {
    options.report(`::notice::the planned base is unknown (${error instanceof Error ? error.message : String(error)}): planning everything`)
    return null
  }
}
