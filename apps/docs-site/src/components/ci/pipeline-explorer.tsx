'use client'

import type { Environment, GitHubRun, RunIndex, RunIndexEntry, RunRecord, RunsPage } from '@/lib/ci/model'
import type { TimelineTask } from '@/lib/ci/pipeline-view'
import type { Status } from './status-line'
import { FetchFailure, fetchJson } from '@/lib/ci/fetch'
import { formatDuration, formatWhen, outcomeCounts, outcomeMark, shortSha, skippedByRule, timelineOf } from '@/lib/ci/pipeline-view'
import { API_URL, CI_WORKFLOW_FILE, PR_WORKFLOW_FILE, RECORDS_BRANCH, RECORDS_URL } from '@/lib/ci/sources'
import { useCallback, useEffect, useState } from 'react'
import { LiveView } from './live-view'
import { OUTCOME_COLOUR, RunTimeline } from './run-timeline'
import { StatusLine, TokenField } from './status-line'

/** Which side of the explorer is open. */
type Tab = 'recorded' | 'live'

/**
 * The pipeline explorer: the runs the main workflow recorded, each drawn as its plan and the
 * timeline of every task, and the runs in progress on GitHub, followed through their check runs.
 * @returns The explorer
 */
export function PipelineExplorer() {
  const [tab, setTab] = useState<Tab>('recorded')
  const [token, setToken] = useState<string | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const onToken = useCallback((next: string | null) => setToken(next), [])
  const onRemaining = useCallback((next: number | null) => setRemaining(next), [])
  const tabClass = (own: Tab) =>
    `rounded-full px-3 py-1 text-sm ${tab === own ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`
  return (
    <div className="ci-explorer">
      <div className="mt-6 flex flex-wrap gap-2" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'recorded'}
          className={tabClass('recorded')}
          onClick={() => setTab('recorded')}
        >
          Recorded runs
        </button>
        <button type="button" role="tab" aria-selected={tab === 'live'} className={tabClass('live')} onClick={() => setTab('live')}>
          Live on GitHub
        </button>
      </div>
      {tab === 'recorded' ? <RecordedRuns /> : <LiveRuns token={token} onRemaining={onRemaining} />}
      {tab === 'live' ? <TokenField onChange={onToken} remaining={remaining} /> : null}
    </div>
  )
}

/**
 * The runs recorded on the records branch, and the one the reader opened.
 * @returns The list and the opened run
 */
function RecordedRuns() {
  const [index, setIndex] = useState<RunIndex | null>(null)
  const [status, setStatus] = useState<Status>({ message: 'Loading the recorded runs…', error: false })
  const [opened, setOpened] = useState<RunIndexEntry | null>(null)
  const [record, setRecord] = useState<RunRecord | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchJson<RunIndex>(`${RECORDS_URL}/index.json`, { signal: controller.signal })
      .then(({ value }) => {
        setIndex(value)
        setStatus({ message: null, error: false })
        setOpened(value.runs[0] ?? null)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setStatus({
          message:
            error instanceof FetchFailure && error.status === 404
              ? `No run has been recorded yet: the main workflow writes the ${RECORDS_BRANCH} branch after its first run with this feature.`
              : `The recorded runs could not be loaded: ${error instanceof Error ? error.message : String(error)}`,
          error: true,
        })
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (opened === null) return
    const controller = new AbortController()
    setRecord(null)
    fetchJson<RunRecord>(`${RECORDS_URL}/runs/${opened.id}.json`, { signal: controller.signal })
      .then(({ value }) => setRecord(value))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setStatus({
          message: `Run #${opened.number} could not be loaded: ${error instanceof Error ? error.message : String(error)}`,
          error: true,
        })
      })
    return () => controller.abort()
  }, [opened])

  return (
    <>
      <StatusLine message={status.message} error={status.error} />
      {index === null ? null : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2">Run</th>
                <th className="px-3 py-2">Commit</th>
                <th className="px-3 py-2">Event</th>
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Outcome</th>
                <th className="px-3 py-2">Recorded</th>
              </tr>
            </thead>
            <tbody>
              {index.runs.slice(0, 50).map((run) => (
                <tr
                  key={run.id}
                  onClick={() => setOpened(run)}
                  className={`cursor-pointer border-t border-slate-200 dark:border-slate-700 ${opened?.id === run.id ? 'bg-primary-50 dark:bg-primary-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}
                >
                  <td className="px-3 py-1.5 font-medium text-slate-900 dark:text-white">#{run.number}</td>
                  <td className="px-3 py-1.5 font-mono text-xs text-slate-600 dark:text-slate-400">{shortSha(run.sha)}</td>
                  <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">{run.event}</td>
                  <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">
                    {run.mode === 'all' ? 'everything' : 'affected'} · {run.chains} chains · {run.tasks} tasks
                    {run.main ? ' · publishing' : ''}
                  </td>
                  <td className="px-3 py-1.5">
                    <OutcomeBadge outcome={run.outcome} />
                  </td>
                  <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">{formatWhen(run.recordedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {opened !== null && record === null && status.message === null ? <StatusLine message={`Loading run #${opened.number}…`} /> : null}
      {record === null ? null : <RunView record={record} />}
    </>
  )
}

/** Props for {@link OutcomeBadge}. */
interface OutcomeBadgeProps {
  /** The outcome of a run */
  outcome: RunIndexEntry['outcome']
}

/**
 * A run's outcome as a coloured word with its glyph.
 * @param props - See {@link OutcomeBadgeProps}.
 * @param props.outcome
 * @returns The badge
 */
function OutcomeBadge({ outcome }: OutcomeBadgeProps) {
  const colour = outcome === 'incomplete' ? 'var(--ci-ink-2)' : OUTCOME_COLOUR[outcome]
  const glyph = outcome === 'incomplete' ? '…' : outcomeMark(outcome).glyph
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: colour }}>
      <span aria-hidden="true">{glyph}</span>
      {outcome}
    </span>
  )
}

/** Props for {@link RunView}. */
interface RunViewProps {
  /** The record opened */
  record: RunRecord
}

/**
 * One recorded run: its identity, each environment's totals and timeline, the selected task's
 * reasons, and the tasks the plan skipped grouped by the rule that made each skip safe.
 * @param props - See {@link RunViewProps}.
 * @param props.record
 * @returns The view
 */
function RunView({ record }: RunViewProps) {
  const [selected, setSelected] = useState<TimelineTask | null>(null)
  return (
    <section className="mt-6">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
        <a href={record.run.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
          Run #{record.run.number}
        </a>{' '}
        <span className="font-mono text-sm text-slate-500 dark:text-slate-400">{shortSha(record.run.sha)}</span>
      </h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        {record.plan.mode === 'all' ? 'Every task of every project' : `What the change reaches from ${shortSha(record.plan.base)}`}:{' '}
        {record.plan.chains.length} chains, {record.plan.chains.reduce((count, chain) => count + chain.tasks.length, 0)} tasks
        {record.plan.main ? ', publishing' : ''}; {record.plan.skipped.length} tasks skipped with a reason. Recorded{' '}
        {formatWhen(record.recordedAt)}.
      </p>
      {record.plan.environments.map((environment: Environment) => {
        const timeline = timelineOf(record, environment)
        const counts = outcomeCounts(timeline)
        return (
          <div key={environment} className="mt-5">
            <h4 className="font-medium text-slate-900 dark:text-white">
              {environment}{' '}
              <span className="text-sm font-normal text-slate-600 dark:text-slate-400">
                ·{' '}
                {[
                  timeline.results === null
                    ? 'no results uploaded'
                    : `${timeline.results.complete ? 'ran' : 'did not end;'} ${formatDuration(timeline.results.durationMs)}`,
                  ...(['success', 'failure', 'skipped', 'cancelled'] as const)
                    .filter((outcome) => counts[outcome] > 0)
                    .map((outcome) => `${counts[outcome]} ${outcome}`),
                  ...(counts.pending > 0 ? [`${counts.pending} without a result`] : []),
                ].join(' · ')}
              </span>
            </h4>
            <RunTimeline timeline={timeline} selected={selected?.task.id ?? null} onSelect={setSelected} />
          </div>
        )
      })}
      {selected === null ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Click a task to read why it was in the plan.</p>
      ) : (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
          <span className="font-mono font-semibold text-slate-900 dark:text-white">{selected.task.id}</span>{' '}
          <span className="text-slate-600 dark:text-slate-400">
            on {selected.task.environment} · {selected.task.weight}
            {selected.task.needs.length === 0 ? '' : ` · after ${selected.task.needs.join(', ')}`}
            {selected.result === null
              ? ''
              : ` · ${outcomeMark(selected.result.outcome).label}${selected.result.startedAt === null ? '' : ` in ${formatDuration(selected.result.durationMs)}`}${selected.result.detail === null ? '' : ` (${selected.result.detail})`}`}
          </span>
          <ul className="mt-2 space-y-1 text-slate-700 dark:text-slate-300">
            {selected.task.reasons.map((reason, index) => (
              <li key={index}>
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{reason.rule}</span> {reason.message}
                {reason.file === null ? '' : <span className="font-mono text-xs"> ({reason.file})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {record.plan.skipped.length === 0 ? null : (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-medium text-slate-900 dark:text-white">
            Skipped tasks, by the rule that made each skip safe
          </summary>
          <ul className="mt-2 space-y-2">
            {skippedByRule(record.plan.skipped).map((group) => (
              <li key={group.rule}>
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{group.rule}</span>{' '}
                <span className="text-slate-600 dark:text-slate-400">({group.tasks.length})</span>
                <p className="mt-0.5 font-mono text-xs text-slate-700 dark:text-slate-300">{group.tasks.join(', ')}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

/** Props for {@link LiveRuns}. */
interface LiveRunsProps {
  /** The reader's token */
  token: string | null
  /** Told the rate limit */
  onRemaining: (remaining: number | null) => void
}

/**
 * The newest runs of the two pipeline workflows on GitHub, and the one the reader follows.
 * @param props - See {@link LiveRunsProps}.
 * @param props.token
 * @param props.onRemaining
 * @returns The list and the followed run
 */
function LiveRuns({ token, onRemaining }: LiveRunsProps) {
  const [runs, setRuns] = useState<GitHubRun[] | null>(null)
  const [status, setStatus] = useState<Status>({ message: 'Listing the runs on GitHub…', error: false })
  const [followed, setFollowed] = useState<GitHubRun | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchJson<RunsPage>(`${API_URL}/actions/runs?per_page=40`, { token, signal: controller.signal })
      .then(({ value, remaining }) => {
        const listed = value.workflow_runs
          .filter((run) => run.path.endsWith(CI_WORKFLOW_FILE) || run.path.endsWith(PR_WORKFLOW_FILE))
          .slice(0, 15)
        setRuns(listed)
        onRemaining(remaining)
        setStatus({ message: null, error: false })
        setFollowed((current) => current ?? listed.find((run) => run.status !== 'completed') ?? listed[0] ?? null)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setStatus({ message: `The runs could not be listed: ${error instanceof Error ? error.message : String(error)}`, error: true })
      })
    return () => controller.abort()
  }, [token, onRemaining])

  return (
    <>
      <StatusLine message={status.message} error={status.error} />
      {runs === null ? null : (
        <ul className="mt-4 flex flex-wrap gap-2">
          {runs.map((run) => (
            <li key={run.id}>
              <button
                type="button"
                onClick={() => setFollowed(run)}
                className={`rounded-lg border px-3 py-1.5 text-left text-xs ${followed?.id === run.id ? 'border-slate-900 dark:border-white' : 'border-slate-200 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500'}`}
              >
                <span className="font-medium text-slate-900 dark:text-white">
                  #{run.run_number} {run.path.endsWith(PR_WORKFLOW_FILE) ? 'pr' : 'ci'}
                </span>{' '}
                <span className="text-slate-600 dark:text-slate-400">
                  {run.head_branch ?? shortSha(run.head_sha)} · {run.status === 'completed' ? (run.conclusion ?? 'completed') : run.status}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {followed === null ? null : <LiveView run={followed} token={token} onRemaining={onRemaining} />}
    </>
  )
}
