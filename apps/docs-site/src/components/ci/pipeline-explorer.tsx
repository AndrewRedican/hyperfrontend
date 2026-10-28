'use client'

import type { RateLimit } from '@/lib/ci/fetch'
import type { CheckRunsPage, Environment, GitHubRun, JobsPage, RunIndex, RunIndexEntry, RunRecord, RunsPage } from '@/lib/ci/model'
import type { TimelineTask } from '@/lib/ci/pipeline-view'
import type { PollPace } from '@/lib/ci/poll'
import type { LiveReading } from './live-view'
import type { Pending } from './placeholder'
import type { Status } from './status-line'
import { FetchFailure, NO_RATE, fetchJson } from '@/lib/ci/fetch'
import { formatDuration, formatWhen, outcomeCounts, outcomeMark, shortSha, skippedByRule, timelineOf } from '@/lib/ci/pipeline-view'
import { CHECK_RUNS_PER_PAGE, laterPages, pollPace } from '@/lib/ci/poll'
import { API_URL, CI_WORKFLOW_FILE, PR_WORKFLOW_FILE, RECORDS_URL } from '@/lib/ci/sources'
import { useCallback, useEffect, useState } from 'react'
import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { promiseAll } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { clearTimeout, setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { LiveView, formatClock } from './live-view'
import { Placeholder, describeFailure, pendingOf } from './placeholder'
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
  const [indexPending, setIndexPending] = useState<Pending>({ state: 'loading', detail: null })
  const [indexAttempt, setIndexAttempt] = useState(0)
  const [opened, setOpened] = useState<RunIndexEntry | null>(null)
  const [record, setRecord] = useState<RunRecord | null>(null)
  const [recordPending, setRecordPending] = useState<Pending>(null)
  const [recordAttempt, setRecordAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setIndexPending({ state: 'loading', detail: null })
    fetchJson<RunIndex>(`${RECORDS_URL}/index.json`, { signal: controller.signal })
      .then(({ value }) => {
        setIndex(value)
        setIndexPending(value.runs.length === 0 ? { state: 'empty', detail: null } : null)
        setOpened(value.runs[0] ?? null)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setIndexPending(pendingOf(error))
      })
    return () => controller.abort()
  }, [indexAttempt])

  useEffect(() => {
    if (opened === null) return
    const controller = new AbortController()
    setRecord(null)
    setRecordPending({ state: 'loading', detail: null })
    fetchJson<RunRecord>(`${RECORDS_URL}/runs/${opened.id}.json`, { signal: controller.signal })
      .then(({ value }) => {
        setRecord(value)
        setRecordPending(null)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setRecordPending(pendingOf(error))
      })
    return () => controller.abort()
  }, [opened, recordAttempt])

  return (
    <>
      {indexPending === null ? null : (
        <Placeholder
          state={indexPending.state}
          motif="pipeline"
          title={
            indexPending.state === 'loading'
              ? 'Loading recorded runs'
              : indexPending.state === 'empty'
                ? 'No runs recorded yet'
                : 'The recorded runs could not be loaded'
          }
          detail={indexPending.state === 'empty' ? 'Runs on main appear here once they finish.' : indexPending.detail}
          onRetry={indexPending.state === 'error' ? () => setIndexAttempt((count) => count + 1) : null}
        />
      )}
      {index === null || index.runs.length === 0 ? null : (
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
      {opened === null || recordPending === null ? null : (
        <Placeholder
          state={recordPending.state}
          motif="pipeline"
          title={
            recordPending.state === 'loading'
              ? `Loading run #${opened.number}`
              : recordPending.state === 'empty'
                ? `Run #${opened.number} has no record`
                : `Run #${opened.number} could not be loaded`
          }
          detail={recordPending.detail}
          onRetry={recordPending.state === 'error' ? () => setRecordAttempt((count) => count + 1) : null}
        />
      )}
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
 * The newest runs of the two pipeline workflows on GitHub, and the one the reader follows: the list,
 * the followed run and its commit's check runs are read together, at the pace the reader's rate
 * limit allows, until the followed run completes.
 * @param props - See {@link LiveRunsProps}.
 * @param props.token
 * @param props.onRemaining
 * @returns The list and the followed run
 */
function LiveRuns({ token, onRemaining }: LiveRunsProps) {
  const [runs, setRuns] = useState<GitHubRun[] | null>(null)
  const [status, setStatus] = useState<Status>({ message: 'Listing the runs on GitHub…', error: false })
  const [chosen, setChosen] = useState<number | null>(null)
  const [reading, setReading] = useState<LiveReading | null>(null)
  const [pace, setPace] = useState<PollPace | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let followed = chosen
    const poll = async () => {
      let requests = 0
      let rate: RateLimit = NO_RATE
      const get = async <Value,>(path: string): Promise<Value> => {
        requests += 1
        try {
          const fetched = await fetchJson<Value>(`${API_URL}/${path}`, { token, signal: controller.signal })
          rate = fetched.rate
          return fetched.value
        } catch (error) {
          if (error instanceof FetchFailure) rate = error.rate
          throw error
        }
      }
      let next: PollPace | null = null
      try {
        const listed = (await get<RunsPage>('actions/runs?per_page=40')).workflow_runs
          .filter((run) => run.path.endsWith(CI_WORKFLOW_FILE) || run.path.endsWith(PR_WORKFLOW_FILE))
          .slice(0, 15)
        followed ??= (listed.find((run) => run.status !== 'completed') ?? listed[0])?.id ?? null
        const run =
          listed.find((entry) => entry.id === followed) ?? (followed === null ? null : await get<GitHubRun>(`actions/runs/${followed}`))
        let found: LiveReading | null = null
        if (run !== null) {
          const checks = `commits/${run.head_sha}/check-runs?per_page=${CHECK_RUNS_PER_PAGE}&page=`
          const first = await get<CheckRunsPage>(`${checks}1`)
          const [later, jobs] = await promiseAll([
            promiseAll(laterPages(first.total_count).map((page) => get<CheckRunsPage>(`${checks}${page}`))),
            get<JobsPage>(`actions/runs/${run.id}/jobs?per_page=100`),
          ])
          found = { run, checkRuns: [first, ...later].flatMap((page) => page.check_runs), jobs: jobs.jobs, readAt: dateNow() }
        }
        if (controller.signal.aborted) return
        setRuns(listed)
        setReading(found)
        setStatus({ message: null, error: false })
        if (found !== null && found.run.status !== 'completed') next = pollPace(requests, rate, dateNow())
      } catch (error) {
        if (controller.signal.aborted) return
        next = pollPace(requests, rate, dateNow())
        setStatus({
          message: `${describeFailure(error)} Trying again at ${formatClock(next.at)}.`,
          error: true,
        })
      }
      onRemaining(rate.remaining)
      setPace(next)
      if (next !== null) timer = setTimeout(() => void poll(), next.at - dateNow())
    }
    void poll()
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [token, chosen, onRemaining])

  const followedId = chosen ?? reading?.run.id ?? null
  return (
    <>
      {runs === null ? (
        <Placeholder
          state={status.error ? 'error' : 'loading'}
          motif="pipeline"
          title={status.error ? 'GitHub could not be read' : 'Reading runs from GitHub'}
          detail={status.error ? status.message : null}
        />
      ) : runs.length === 0 ? (
        <Placeholder state="empty" motif="pipeline" title="No pipeline runs on GitHub yet" />
      ) : (
        <StatusLine message={status.error ? `GitHub could not be read: ${status.message}` : null} error />
      )}
      {runs === null || runs.length === 0 ? null : (
        <ul className="mt-4 flex flex-wrap gap-2">
          {runs.map((run) => (
            <li key={run.id}>
              <button
                type="button"
                onClick={() => setChosen(run.id)}
                className={`rounded-lg border px-3 py-1.5 text-left text-xs ${followedId === run.id ? 'border-slate-900 dark:border-white' : 'border-slate-200 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500'}`}
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
      {reading === null ? null : <LiveView key={reading.run.id} reading={reading} pace={pace} />}
    </>
  )
}
