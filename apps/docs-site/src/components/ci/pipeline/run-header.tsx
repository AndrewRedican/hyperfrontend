'use client'

import type { Execution } from '@/lib/ci/execution'
import type { RunSummary } from '@/lib/ci/run-browser'
import { formatAgo, formatDuration, formatWhen, shortSha } from '@/lib/ci/pipeline-view'
import { durationOf } from '@/lib/ci/run-browser'
import { ENVIRONMENT_LABEL } from '@/lib/ci/vocabulary'
import { REPO_URL } from '@/lib/site'
import { ExternalLink, OsIcon, StateMark, stateOfRun } from './marks'

/** Props for {@link RunHeader}. */
export interface RunHeaderProps {
  /** The selected run */
  summary: RunSummary
  /** Its execution, or null before it is read */
  execution: Execution | null
  /** The current time */
  now: number
}

/**
 * What a run stands as, in words.
 * @param summary - The run
 * @param execution - Its execution, or null
 * @returns `succeeded`, `running`, `failed`, and so on
 */
function wording(summary: RunSummary, execution: Execution | null): string {
  const status = execution?.status ?? summary.status
  if (status === 'queued') return 'queued'
  if (status === 'in_progress') return 'running'
  const outcome = execution?.outcome ?? summary.outcome
  switch (outcome) {
    case 'success':
      return 'succeeded'
    case 'failure':
      return 'failed'
    case 'cancelled':
      return 'cancelled'
    case 'incomplete':
      return 'incomplete'
    default:
      return summary.conclusion ?? 'completed'
  }
}

/**
 * The selected run in one row: its state, number, commit, branch, plan and timing, with a chip
 * per environment job and per other job once the execution is known.
 * @param props - See {@link RunHeaderProps}.
 * @param props.summary
 * @param props.execution
 * @param props.now
 * @returns The header
 */
export function RunHeader({ summary, execution, now }: RunHeaderProps) {
  const status = execution?.status ?? summary.status
  const outcome = execution?.outcome ?? summary.outcome ?? summary.conclusion
  const clock = execution?.clock ?? null
  const duration = clock !== null && clock.start !== null && clock.end !== null ? clock.end - clock.start : durationOf(summary)
  const plan = execution?.plan ?? null
  const tasks = execution === null ? summary.tasks : execution.chains.reduce((count, chain) => count + chain.tasks.length, 0)
  const chains = execution === null ? summary.chains : execution.chains.length
  return (
    <header className="mt-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <StateMark state={stateOfRun(status, outcome)} of={`run #${summary.number}`} size={20} />
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          <ExternalLink href={summary.url} className="no-underline hover:underline" title="The run on GitHub Actions">
            Run #{summary.number}
          </ExternalLink>
          {summary.attempt > 1 ? <span className="ml-1 text-sm font-normal text-slate-500">attempt {summary.attempt}</span> : null}
        </h2>
        <span className="text-sm text-slate-600 dark:text-slate-400">
          {wording(summary, execution)}
          {duration === null
            ? ''
            : execution === null
              ? ` in ${formatDuration(duration)}`
              : `, the runners took ${formatDuration(duration)}`}
          {status !== 'completed' && clock?.start !== null && clock?.start !== undefined
            ? ` so far, since ${formatAgo(clock.start, now)}`
            : ''}
        </span>
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
          <ExternalLink href={`${REPO_URL}/commit/${summary.sha}`} title={`Commit ${summary.sha}`}>
            {shortSha(summary.sha)}
          </ExternalLink>
          {summary.branch === null ? '' : ` on ${summary.branch}`}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400" title={formatWhen(summary.at)}>
          {summary.workflow === 'pr' ? 'pull request' : summary.event === 'workflow_dispatch' ? 'started by hand' : summary.event} ·{' '}
          {formatAgo(summary.at, now)}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        {plan === null
          ? tasks === null
            ? execution === null
              ? 'Reading the plan…'
              : 'No plan published yet.'
            : ''
          : plan.mode === 'all'
            ? 'Every task of every project'
            : `What the change reaches from ${shortSha(plan.base)}`}
        {tasks === null ? '' : `${plan === null ? '' : ': '}${chains} chains, ${tasks} tasks`}
        {plan?.main === true ? ', publishing' : ''}
        {plan !== null && plan.skipped > 0 ? `; ${plan.skipped} task${plan.skipped === 1 ? '' : 's'} left out with a reason` : ''}
        {plan?.truncated === true ? ' (the live plan dropped its dependencies to fit, so nothing here is shown waiting)' : ''}
        {summary.title !== null && summary.title !== '' ? ` · ${summary.title}` : ''}
      </p>
      {execution === null ? null : (
        <ul className="mt-2 flex flex-wrap gap-1.5 text-xs" aria-label="Jobs">
          {execution.stages
            .filter((stage) => stage.name === 'plan')
            .map((stage) => (
              <li
                key={stage.name}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2 py-0.5 text-slate-700 dark:border-slate-700 dark:text-slate-300"
              >
                <StateMark state={stateOfRun(stage.status, stage.conclusion)} of={stage.name} size={12} />
                plan
                {stage.startedAt !== null && stage.endedAt !== null ? (
                  <span className="text-slate-500">{formatDuration(stage.endedAt - stage.startedAt)}</span>
                ) : null}
              </li>
            ))}
          {execution.lanes.map((lane) => (
            <li
              key={lane.environment}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2 py-0.5 text-slate-700 dark:border-slate-700 dark:text-slate-300"
            >
              <StateMark
                state={stateOfRun(lane.status, lane.complete ? lane.conclusion : lane.status === 'completed' ? 'incomplete' : null)}
                of={`${ENVIRONMENT_LABEL[lane.environment]} job`}
                size={12}
              />
              <OsIcon environment={lane.environment} className="h-3 w-3" named />
              {lane.startedAt !== null && lane.endedAt !== null ? (
                <span className="text-slate-500">{formatDuration(lane.endedAt - lane.startedAt)}</span>
              ) : null}
              {lane.url === null ? null : (
                <ExternalLink href={lane.url} className="text-slate-500" title="The job on GitHub">
                  ↗
                </ExternalLink>
              )}
            </li>
          ))}
          {execution.stages
            .filter((stage) => stage.name !== 'plan')
            .map((stage) => (
              <li
                key={stage.name}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2 py-0.5 text-slate-600 dark:border-slate-700 dark:text-slate-400"
              >
                <StateMark state={stateOfRun(stage.status, stage.conclusion)} of={stage.name} size={12} />
                {stage.name}
              </li>
            ))}
        </ul>
      )}
    </header>
  )
}
