'use client'

import type { BrowserQuery, RunFilter, RunSummary, SortKey } from '@/lib/ci/run-browser'
import type { Pending } from '../placeholder'
import { formatAgo, formatDuration, formatWhen, shortSha } from '@/lib/ci/pipeline-view'
import { PAGE_SIZE, durationOf, queryRuns } from '@/lib/ci/run-browser'
import { REPO_URL } from '@/lib/site'
import { useMemo } from 'react'
import { Placeholder } from '../placeholder'
import { ExternalLink, OsIcon, StateMark, stateOfRun } from './marks'

/** Props for {@link RunBrowser}. */
export interface RunBrowserProps {
  /** Every run known */
  runs: readonly RunSummary[]
  /** The selected run id, or null */
  selected: number | null
  /** Selects a run */
  onSelect: (id: number) => void
  /** What the browser shows */
  query: BrowserQuery
  /** Changes what it shows */
  onQuery: (query: BrowserQuery) => void
  /** Why the records are not here, or null */
  indexPending: Pending
  /** Why GitHub's list is not here, or null */
  listPending: Pending
  /** The current time, for the relative times */
  now: number
  /** Reads the lists again */
  onRetry: () => void
}

/** A column of the table. */
interface Column {
  /** What it orders by */
  key: SortKey
  /** Its heading */
  label: string
  /** Classes for its cells */
  className: string
}

/** A filter of the rows. */
interface Filter {
  /** Which rows it keeps */
  key: RunFilter
  /** Its label */
  label: string
}

/** The columns, with the key each orders by. */
const COLUMNS: readonly Column[] = [
  { key: 'outcome', label: 'State', className: 'w-14 text-center' },
  { key: 'number', label: 'Run', className: '' },
  { key: 'at', label: 'When', className: '' },
  { key: 'tasks', label: 'Plan', className: '' },
  { key: 'duration', label: 'Took', className: 'text-right' },
]

/** The filters, in order. */
const FILTERS: readonly Filter[] = [
  { key: 'all', label: 'All' },
  { key: 'failed', label: 'Needs attention' },
  { key: 'active', label: 'Running' },
  { key: 'ci', label: 'main' },
  { key: 'pr', label: 'Pull requests' },
]

/**
 * What a run stands as, in a few words for a tooltip.
 * @param run - The run
 * @returns The sentence
 */
function describeState(run: RunSummary): string {
  if (run.status !== 'completed') return run.status === 'queued' ? 'queued on GitHub' : 'running on GitHub'
  const outcome = run.outcome ?? run.conclusion ?? 'completed'
  return run.recorded ? `${outcome}, recorded` : `${outcome} on GitHub, not recorded`
}

/**
 * What a run planned, in a few words.
 * @param run - The run
 * @returns `affected · 119 chains · 499 tasks · publishing`, or what little is known
 */
function describePlan(run: RunSummary): string {
  if (run.tasks === null) return run.workflow === 'pr' ? 'pull request' : 'not recorded'
  return [
    run.mode === 'all' ? 'everything' : 'affected',
    `${run.chains} chains`,
    `${run.tasks} tasks`,
    ...(run.main === true ? ['publishing'] : []),
  ].join(' · ')
}

/**
 * The runs as a compact browser: ten at a time, newest first, ordered by any column, narrowed by a
 * filter or a search, the selected one marked, each linking to its run and commit on GitHub.
 * @param props - See {@link RunBrowserProps}.
 * @param props.runs
 * @param props.selected
 * @param props.onSelect
 * @param props.query
 * @param props.onQuery
 * @param props.indexPending
 * @param props.listPending
 * @param props.now
 * @param props.onRetry
 * @returns The browser
 */
export function RunBrowser({ runs, selected, onSelect, query, onQuery, indexPending, listPending, now, onRetry }: RunBrowserProps) {
  const page = useMemo(() => queryRuns(runs, query), [runs, query])
  const sortBy = (key: SortKey) => onQuery({ ...query, sort: key, descending: query.sort === key ? !query.descending : true, page: 0 })
  const both = indexPending?.state === 'error' && listPending?.state === 'error'
  if (runs.length === 0) {
    const loading = indexPending?.state === 'loading' || listPending?.state === 'loading'
    return (
      <Placeholder
        state={loading ? 'loading' : both ? 'error' : 'empty'}
        motif="pipeline"
        title={loading ? 'Listing the runs' : both ? 'The runs could not be listed' : 'No runs yet'}
        detail={
          both ? (indexPending?.detail ?? listPending?.detail ?? null) : loading ? null : 'Runs appear here once the pipeline has run.'
        }
        onRetry={both ? onRetry : null}
      />
    )
  }
  return (
    <section aria-label="Runs" className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filter" className="flex flex-wrap gap-1">
          {FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              aria-pressed={query.filter === filter.key}
              onClick={() => onQuery({ ...query, filter: filter.key, page: 0 })}
              className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                query.filter === filter.key
                  ? 'border-slate-400 bg-slate-100 text-slate-900 dark:border-slate-500 dark:bg-slate-800 dark:text-white'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={query.text}
          onChange={(event) => onQuery({ ...query, text: event.target.value, page: 0 })}
          placeholder="Run, commit, branch…"
          aria-label="Search runs"
          className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-900 sm:max-w-56 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
        />
        <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
          {page.total === runs.length ? `${runs.length} runs` : `${page.total} of ${runs.length} runs`}
        </span>
      </div>
      {listPending?.state === 'error' ? (
        <p role="status" className="mt-2 text-xs text-amber-700 dark:text-amber-300">
          GitHub could not be listed, so only the recorded runs are here: {listPending.detail}
        </p>
      ) : null}
      {indexPending?.state === 'error' ? (
        <p role="status" className="mt-2 text-xs text-amber-700 dark:text-amber-300">
          The records could not be read, so only what GitHub lists is here: {indexPending.detail}
        </p>
      ) : null}
      <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-left text-sm">
          <thead className="hidden bg-slate-50 text-xs text-slate-500 sm:table-header-group dark:bg-slate-800 dark:text-slate-400">
            <tr>
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`px-2 py-1.5 font-medium ${column.className}`}
                  aria-sort={query.sort === column.key ? (query.descending ? 'descending' : 'ascending') : 'none'}
                >
                  <button
                    type="button"
                    onClick={() => sortBy(column.key)}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    {column.label}
                    <span aria-hidden="true" className={query.sort === column.key ? '' : 'opacity-30'}>
                      {query.sort === column.key && !query.descending ? '↑' : '↓'}
                    </span>
                  </button>
                </th>
              ))}
              <th scope="col" className="px-2 py-1.5 text-right font-medium">
                Links
              </th>
            </tr>
          </thead>
          <tbody>
            {page.rows.map((run) => {
              const isSelected = run.id === selected
              const duration = durationOf(run)
              return (
                <tr
                  key={run.id}
                  aria-selected={isSelected}
                  onClick={() => onSelect(run.id)}
                  className={`cursor-pointer border-t border-slate-200 dark:border-slate-700 ${
                    isSelected ? 'bg-primary-50 dark:bg-primary-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <td className="px-2 py-1.5 text-center align-middle">
                    <StateMark
                      state={stateOfRun(run.status, run.outcome ?? run.conclusion)}
                      of={`run #${run.number}, ${describeState(run)}`}
                    />
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    <button
                      type="button"
                      onClick={() => onSelect(run.id)}
                      aria-current={isSelected ? 'true' : undefined}
                      className={`text-left font-medium ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-800 dark:text-slate-200'}`}
                    >
                      #{run.number}
                      {run.attempt > 1 ? <span className="text-xs text-slate-500">·{run.attempt}</span> : null}
                    </button>
                    <span className="ml-2 text-xs text-slate-500 dark:text-slate-400" title={run.title ?? undefined}>
                      {run.workflow === 'pr' ? 'PR' : run.event === 'workflow_dispatch' ? 'manual' : (run.branch ?? run.event)}
                    </span>
                    <div className="mt-0.5 text-xs text-slate-500 sm:hidden dark:text-slate-400">
                      {formatAgo(run.at, now)} · {describePlan(run)}
                      {duration === null ? '' : ` · ${formatDuration(duration)}`}
                    </div>
                  </td>
                  <td
                    className="hidden px-2 py-1.5 align-middle text-xs text-slate-600 sm:table-cell dark:text-slate-400"
                    title={formatWhen(run.at)}
                  >
                    {formatAgo(run.at, now)}
                  </td>
                  <td className="hidden px-2 py-1.5 align-middle text-xs text-slate-600 sm:table-cell dark:text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      {run.environments === null ? null : (
                        <span className="inline-flex gap-0.5 text-slate-500 dark:text-slate-400">
                          {run.environments.map((environment) => (
                            <OsIcon key={environment} environment={environment} className="h-3 w-3" />
                          ))}
                        </span>
                      )}
                      {describePlan(run)}
                    </span>
                  </td>
                  <td className="hidden px-2 py-1.5 text-right align-middle text-xs tabular-nums text-slate-600 sm:table-cell dark:text-slate-400">
                    {duration === null ? (run.status === 'completed' ? '–' : 'running') : formatDuration(duration)}
                  </td>
                  <td className="px-2 py-1.5 text-right align-middle text-xs whitespace-nowrap">
                    <span className="inline-flex flex-col items-end gap-0.5 font-mono sm:flex-row sm:items-center sm:gap-2">
                      <ExternalLink href={run.url} title="The run on GitHub Actions">
                        run
                      </ExternalLink>
                      <ExternalLink href={`${REPO_URL}/commit/${run.sha}`} title={`Commit ${run.sha}`}>
                        {shortSha(run.sha)}
                      </ExternalLink>
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {page.pages > 1 ? (
        <nav aria-label="Pages" className="mt-2 flex items-center justify-end gap-2 text-xs text-slate-600 dark:text-slate-400">
          <button
            type="button"
            disabled={page.page === 0}
            onClick={() => onQuery({ ...query, page: page.page - 1 })}
            className="rounded border border-slate-300 px-2 py-0.5 disabled:opacity-40 dark:border-slate-600"
          >
            Previous
          </button>
          <span>
            {page.page * PAGE_SIZE + 1}–{page.page * PAGE_SIZE + page.rows.length} of {page.total}
          </span>
          <button
            type="button"
            disabled={page.page >= page.pages - 1}
            onClick={() => onQuery({ ...query, page: page.page + 1 })}
            className="rounded border border-slate-300 px-2 py-0.5 disabled:opacity-40 dark:border-slate-600"
          >
            Next
          </button>
        </nav>
      ) : null}
    </section>
  )
}
