import type { ExecutionStatus, Workflow } from './execution'
import type { Environment, GitHubRun, RunIndex, RunOutcome } from './model'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { ceil, max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { epochOf, outcomeOfConclusion, workflowOf } from './execution'

/** One run as the browser lists it: what the records branch and GitHub together know of it. */
export interface RunSummary {
  /** The run id */
  id: number
  /** The run number */
  number: number
  /** The attempt */
  attempt: number
  /** The commit */
  sha: string
  /** The branch, or null */
  branch: string | null
  /** The event that started it */
  event: string
  /** The run's page */
  url: string
  /** Which workflow */
  workflow: Workflow
  /** Where the run stands */
  status: ExecutionStatus
  /** What it ended as, or null */
  outcome: RunOutcome | null
  /** The conclusion as GitHub words it, or null */
  conclusion: string | null
  /** Whether the records branch holds its record */
  recorded: boolean
  /** Whether GitHub listed it */
  listed: boolean
  /** Whether the plan was selected or ran everything, or null when unknown */
  mode: 'affected' | 'all' | null
  /** Whether the plan published, or null when unknown */
  main: boolean | null
  /** The environments with chains, or null when unknown */
  environments: readonly Environment[] | null
  /** How many chains, or null when unknown */
  chains: number | null
  /** How many tasks, or null when unknown */
  tasks: number | null
  /** When the run started, or null when unknown */
  startedAt: number | null
  /** When the run ended, or null while it runs or when unknown */
  endedAt: number | null
  /** The time the browser orders by: the start, or the recording when only the record is known */
  at: number
  /** The title GitHub shows, or null */
  title: string | null
}

/** What the rows are ordered by. */
export type SortKey = 'at' | 'number' | 'outcome' | 'duration' | 'tasks'

/** Which rows are kept. */
export type RunFilter = 'all' | 'failed' | 'active' | 'ci' | 'pr'

/** What the browser shows. */
export interface BrowserQuery {
  /** The order */
  sort: SortKey
  /** Whether the order is reversed, newest or largest first */
  descending: boolean
  /** Text a row must contain, in its number, commit, branch, event or title */
  text: string
  /** Which rows are kept */
  filter: RunFilter
  /** The page, from zero */
  page: number
}

/** How the browser opens. */
export const DEFAULT_QUERY: BrowserQuery = { sort: 'at', descending: true, text: '', filter: 'all', page: 0 }

/** How many rows a page holds. */
export const PAGE_SIZE = 10

/** One page of rows. */
export interface BrowserPage {
  /** The rows of the page */
  rows: RunSummary[]
  /** How many rows the query keeps across every page */
  total: number
  /** How many pages */
  pages: number
  /** The page shown, from zero, within the pages */
  page: number
}

/**
 * How long a run took.
 *
 * @param summary - The run
 * @returns Milliseconds, or null while it runs or when unknown
 */
export function durationOf(summary: RunSummary): number | null {
  return summary.startedAt === null || summary.endedAt === null ? null : summary.endedAt - summary.startedAt
}

/**
 * The runs the records branch and GitHub together know, each once, newest first.
 *
 * @param index - The records index, or null before it is read
 * @param listed - The runs GitHub listed, or null before they are read
 * @returns The summaries
 */
export function mergeRuns(index: RunIndex | null, listed: readonly GitHubRun[] | null): RunSummary[] {
  const byId = createMap<number, RunSummary>()
  for (const run of listed ?? []) {
    const startedAt = epochOf(run.run_started_at) ?? epochOf(run.created_at)
    byId.set(run.id, {
      id: run.id,
      number: run.run_number,
      attempt: run.run_attempt,
      sha: run.head_sha,
      branch: run.head_branch,
      event: run.event,
      url: run.html_url,
      workflow: workflowOf(run.path),
      status: run.status === 'completed' ? 'completed' : run.status === 'queued' ? 'queued' : 'in_progress',
      outcome: outcomeOfConclusion(run.conclusion),
      conclusion: run.conclusion,
      recorded: false,
      listed: true,
      mode: null,
      main: null,
      environments: null,
      chains: null,
      tasks: null,
      startedAt,
      endedAt: run.status === 'completed' ? epochOf(run.updated_at) : null,
      at: startedAt ?? 0,
      title: run.display_title,
    })
  }
  for (const entry of index?.runs ?? []) {
    const known = byId.get(entry.id)
    byId.set(entry.id, {
      id: entry.id,
      number: entry.number,
      attempt: known?.attempt ?? entry.attempt,
      sha: entry.sha,
      branch: known?.branch ?? (entry.ref.startsWith('refs/heads/') ? entry.ref.slice('refs/heads/'.length) : null),
      event: entry.event,
      url: entry.url,
      workflow: 'ci',
      status: 'completed',
      outcome: entry.outcome,
      conclusion: known?.conclusion ?? entry.outcome,
      recorded: true,
      listed: known !== undefined,
      mode: entry.mode,
      main: entry.main,
      environments: entry.environments,
      chains: entry.chains,
      tasks: entry.tasks,
      startedAt: known?.startedAt ?? null,
      endedAt: known?.endedAt ?? null,
      at: known?.startedAt ?? entry.recordedAt,
      title: known?.title ?? null,
    })
  }
  return [...byId.values()].sort((left, right) => right.at - left.at || right.number - left.number)
}

/**
 * The run the browser opens with: the newest.
 *
 * @param runs - The merged runs
 * @returns The newest run, or null when there is none
 */
export function newestRun(runs: readonly RunSummary[]): RunSummary | null {
  return runs.reduce<RunSummary | null>((newest, run) => (newest === null || run.at > newest.at ? run : newest), null)
}

/**
 * The rank of a run's outcome when the rows are ordered by it: what needs attention first.
 *
 * @param summary - The run
 * @returns Lower for a failure, higher for a success
 */
export function outcomeRank(summary: RunSummary): number {
  if (summary.status !== 'completed') return 2
  switch (summary.outcome) {
    case 'failure':
      return 0
    case 'cancelled':
      return 1
    case 'incomplete':
      return 3
    case 'success':
      return 5
    default:
      return 4
  }
}

/**
 * Whether a run passes a filter.
 *
 * @param summary - The run
 * @param filter - Which runs are kept
 * @returns True when the run is kept
 */
export function passesFilter(summary: RunSummary, filter: RunFilter): boolean {
  switch (filter) {
    case 'failed':
      return summary.outcome === 'failure' || summary.outcome === 'cancelled' || summary.outcome === 'incomplete'
    case 'active':
      return summary.status !== 'completed'
    case 'ci':
      return summary.workflow === 'ci'
    case 'pr':
      return summary.workflow === 'pr'
    default:
      return true
  }
}

/**
 * Whether a run's number, commit, branch, event or title contains some text.
 *
 * @param summary - The run
 * @param text - The text, matched without regard to case
 * @returns True when the text is empty or found
 */
export function matchesText(summary: RunSummary, text: string): boolean {
  const needle = text.trim().toLowerCase()
  if (needle === '') return true
  return [`#${summary.number}`, summary.sha, summary.branch ?? '', summary.event, summary.title ?? '']
    .join(' ')
    .toLowerCase()
    .includes(needle)
}

/**
 * The order of two runs under a key.
 *
 * @param left - One run
 * @param right - The other
 * @param sort - The key
 * @returns Negative when the left comes first in ascending order
 */
function compare(left: RunSummary, right: RunSummary, sort: SortKey): number {
  switch (sort) {
    case 'number':
      return left.number - right.number
    case 'outcome':
      return outcomeRank(left) - outcomeRank(right)
    case 'duration':
      return (durationOf(left) ?? -1) - (durationOf(right) ?? -1)
    case 'tasks':
      return (left.tasks ?? -1) - (right.tasks ?? -1)
    default:
      return left.at - right.at
  }
}

/**
 * The page of runs a query shows.
 *
 * @param runs - The merged runs
 * @param query - The order, the filter, the text and the page
 * @returns The rows of the page, with the totals
 */
export function queryRuns(runs: readonly RunSummary[], query: BrowserQuery): BrowserPage {
  const kept = runs
    .filter((run) => passesFilter(run, query.filter) && matchesText(run, query.text))
    .sort((left, right) => {
      const order = compare(left, right, query.sort) || left.at - right.at || left.number - right.number
      return query.descending ? -order : order
    })
  const pages = max(1, ceil(kept.length / PAGE_SIZE))
  const page = max(0, query.page >= pages ? pages - 1 : query.page)
  return { rows: kept.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), total: kept.length, pages, page }
}
