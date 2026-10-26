'use client'

import type { LiveChain, LiveTask } from '@/lib/ci/live'
import type { CheckRunsPage, GitHubCheckRun, GitHubJob, GitHubRun, JobsPage } from '@/lib/ci/model'
import type { Status } from './status-line'
import { fetchJson } from '@/lib/ci/fetch'
import { presentProject } from '@/lib/ci/labels'
import { environmentJob, liveProgress, liveRun } from '@/lib/ci/live'
import { formatDuration, outcomeMark, shortSha } from '@/lib/ci/pipeline-view'
import { API_URL, LIVE_POLL_MS } from '@/lib/ci/sources'
import { useEffect, useState } from 'react'
import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { promiseAll } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { clearInterval, setInterval } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { InlineIcon } from './node-icon'
import { OUTCOME_COLOUR } from './run-timeline'
import { StatusLine } from './status-line'

/** Props for {@link LiveView}. */
export interface LiveViewProps {
  /** The run followed */
  run: GitHubRun
  /** The reader's token, or null */
  token: string | null
  /** Told the rate limit GitHub reported */
  onRemaining: (remaining: number | null) => void
}

/**
 * A pipeline as it runs: the chains of its plan with every task's state, read from the check
 * runs of the commit every minute until the workflow run completes.
 * @param props - See {@link LiveViewProps}.
 * @param props.run - The run
 * @param props.token - The reader's token
 * @param props.onRemaining - Told the rate limit
 * @returns The view
 */
export function LiveView({ run, token, onRemaining }: LiveViewProps) {
  const [checkRuns, setCheckRuns] = useState<GitHubCheckRun[] | null>(null)
  const [jobs, setJobs] = useState<GitHubJob[]>([])
  const [status, setStatus] = useState<Status>({ message: 'Reading the check runs…', error: false })
  const [readAt, setReadAt] = useState<number | null>(null)
  const [selected, setSelected] = useState<LiveTask | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const read = async () => {
      try {
        const [checks, listed] = await promiseAll([
          fetchJson<CheckRunsPage>(`${API_URL}/commits/${run.head_sha}/check-runs?per_page=100`, {
            token,
            signal: controller.signal,
          }),
          fetchJson<JobsPage>(`${API_URL}/actions/runs/${run.id}/jobs?per_page=100`, { token, signal: controller.signal }),
        ])
        if (!active) return
        setCheckRuns(checks.value.check_runs)
        setJobs(listed.value.jobs)
        onRemaining(listed.remaining ?? checks.remaining)
        setReadAt(dateNow())
        setStatus({ message: null, error: false })
      } catch (error) {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return
        setStatus({ message: `The run could not be read: ${error instanceof Error ? error.message : String(error)}`, error: true })
      }
    }
    void read()
    const timer = run.status === 'completed' ? null : setInterval(() => void read(), LIVE_POLL_MS)
    return () => {
      active = false
      controller.abort()
      if (timer !== null) clearInterval(timer)
    }
  }, [run, token, onRemaining])

  const live = checkRuns === null ? null : liveRun(checkRuns)
  const progress = live === null ? null : liveProgress(live)
  return (
    <section className="ci-explorer mt-4">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
        <a href={run.html_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
          Run #{run.run_number}
        </a>{' '}
        <span className="font-mono text-sm text-slate-500 dark:text-slate-400">{shortSha(run.head_sha)}</span>{' '}
        <span className="text-sm font-normal text-slate-600 dark:text-slate-400">
          · {run.event} on {run.head_branch ?? 'a detached commit'} · {run.status}
          {run.conclusion === null ? '' : `, ${run.conclusion}`}
        </span>
      </h3>
      <StatusLine message={status.message} error={status.error} />
      {live === null || progress === null ? null : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
            <span>
              {progress.ended} of {progress.total} tasks ended
            </span>
            <div
              className="h-2 w-48 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.ended}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${progress.total === 0 ? 0 : (progress.ended / progress.total) * 100}%`,
                  background: 'var(--ci-series-1)',
                }}
              />
            </div>
            {(['linux', 'windows'] as const).map((environment) => {
              const job = environmentJob(jobs, environment)
              return (
                <span key={environment} className="rounded-full border border-slate-300 px-2 py-0.5 text-xs dark:border-slate-600">
                  {environment}: {job === null ? 'no job' : `${job.status}${job.conclusion === null ? '' : `, ${job.conclusion}`}`}
                </span>
              )
            })}
            {readAt === null ? null : (
              <span className="text-xs">
                read {new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' }).format(readAt)}
                {run.status === 'completed' ? '' : `, again in ${formatDuration(LIVE_POLL_MS)}`}
              </span>
            )}
          </div>
          {live.plan === null ? (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              The run has not published its plan yet, or predates the plan check run; {checkRuns?.length ?? 0} check runs are on the commit.
            </p>
          ) : (
            <>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                {live.plan.mode === 'all' ? 'Every task of every project' : 'The tasks the change reaches'}, {live.plan.chains.length}{' '}
                chains, {live.plan.skipped} tasks skipped with a reason
                {live.plan.main ? ', publishing' : ''}.
              </p>
              <ul className="mt-3 space-y-1.5">
                {live.chains.map((chain) => (
                  <ChainRow key={`${chain.project}:${chain.environment}`} chain={chain} selected={selected} onSelect={setSelected} />
                ))}
              </ul>
            </>
          )}
          {selected === null ? null : (
            <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
              <span className="font-mono font-semibold text-slate-900 dark:text-white">{selected.id}</span>{' '}
              <span className="text-slate-600 dark:text-slate-400">
                · {selected.weight} ·{' '}
                {selected.state === 'ended'
                  ? `${outcomeMark(selected.outcome).label}${selected.startedAt !== null && selected.endedAt !== null ? ` in ${formatDuration(selected.endedAt - selected.startedAt)}` : ''}`
                  : selected.state}
                {selected.detail === null ? '' : ` · ${selected.detail}`}
                {selected.needs.length === 0 ? '' : ` · after ${selected.needs.join(', ')}`}
              </span>
            </div>
          )}
        </>
      )}
    </section>
  )
}

/** Props for {@link ChainRow}. */
interface ChainRowProps {
  /** The chain */
  chain: LiveChain
  /** The selected task */
  selected: LiveTask | null
  /** Selects a task */
  onSelect: (task: LiveTask) => void
}

/**
 * One chain: its project and environment, its status, and a chip per task coloured by state.
 * @param props - See {@link ChainRowProps}.
 * @param props.chain
 * @param props.selected
 * @param props.onSelect
 * @returns The row
 */
function ChainRow({ chain, selected, onSelect }: ChainRowProps) {
  return (
    <li className="flex flex-wrap items-center gap-2 text-xs">
      <span className="inline-flex w-48 items-center gap-1.5 truncate font-mono text-slate-900 dark:text-white" title={chain.project}>
        <InlineIcon kind={presentProject(chain.project).icon} className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
        {chain.url === null ? (
          presentProject(chain.project).label
        ) : (
          <a href={chain.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {presentProject(chain.project).label}
          </a>
        )}
      </span>
      <span className="w-16 text-slate-500 dark:text-slate-400">{chain.environment}</span>
      <span className="w-24 text-slate-500 dark:text-slate-400">
        {chain.status === 'completed' ? (chain.conclusion ?? 'completed') : chain.status.replace('_', ' ')}
      </span>
      <span className="flex flex-wrap gap-1">
        {chain.tasks.map((task) => (
          <button
            key={task.id}
            type="button"
            onClick={() => onSelect(task)}
            className={`rounded px-1.5 py-0.5 font-mono ${selected?.id === task.id ? 'ring-2 ring-slate-900 dark:ring-white' : ''}`}
            style={
              task.state === 'ended' && task.outcome !== null
                ? { background: OUTCOME_COLOUR[task.outcome], color: '#fff' }
                : task.state === 'pending'
                  ? { border: '1px solid var(--ci-series-1)', color: 'var(--ci-series-1)' }
                  : { border: '1px dashed var(--ci-line)', color: 'var(--ci-ink-2)' }
            }
            title={`${task.id}: ${task.state === 'ended' ? outcomeMark(task.outcome).label : task.state}`}
          >
            {task.state === 'ended' ? `${outcomeMark(task.outcome).glyph} ` : ''}
            {task.target}
          </button>
        ))}
      </span>
    </li>
  )
}
