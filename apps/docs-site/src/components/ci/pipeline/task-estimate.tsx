'use client'

import type { RunEstimate, TaskEstimate } from '@/lib/ci/estimate'
import type { Execution, ExecutionTask } from '@/lib/ci/execution'
import type { HistoryState } from './use-history'
import { taskKey } from '@/lib/ci/estimate'
import { formatClock, formatDuration, formatRough, formatRoughRange } from '@/lib/ci/pipeline-view'
import { ENVIRONMENT_LABEL } from '@/lib/ci/vocabulary'
import { abs, max, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** Props for {@link TaskEstimateRows}. */
export interface TaskEstimateRowsProps {
  /** The task */
  task: ExecutionTask
  /** Its execution */
  execution: Execution
  /** The run's estimate */
  estimate: RunEstimate
  /** Where the history behind it stands */
  history: HistoryState
  /** The current time */
  now: number
}

/** The classes of a row's term. */
const TERM = 'text-slate-500 dark:text-slate-400'

/**
 * How long a task usually takes, in words.
 * @param task - The task
 * @param estimate - Its estimate, or null
 * @param history - Where the history stands
 * @returns The sentence
 */
function usually(task: ExecutionTask, estimate: TaskEstimate | null, history: HistoryState): string {
  const expected = estimate?.expected ?? null
  const where = ENVIRONMENT_LABEL[task.environment]
  if (expected === null) {
    if (history === 'loading') return 'reading the recorded runs…'
    if (history === 'error') return 'unknown: no recorded run could be read'
    return `unknown: no recorded run before this one ran it on ${where}, nor enough ${task.target} tasks to go by`
  }
  if (expected.basis === 'target')
    return `about ${formatDuration(expected.mid)}, going by ${expected.samples} recorded runs of other projects' ${task.target} tasks on ${where}: none ran this one`
  if (expected.samples === 1) return `${formatDuration(expected.mid)} in the one recorded run of it on ${where}`
  return `${formatDuration(expected.mid)}, from ${formatDuration(expected.low)} to ${formatDuration(expected.high)} over its last ${expected.samples} recorded runs on ${where}`
}

/**
 * When a task that has not ended is expected to, in words.
 * @param estimate - The run's estimate
 * @param task - The task's estimate, or null
 * @param history - Where the history stands
 * @param now - The current time
 * @returns The sentence
 */
function eta(estimate: RunEstimate, task: TaskEstimate | null, history: HistoryState, now: number): string {
  if (estimate.basis === 'truncated') return 'none: the live plan dropped its dependencies to fit, so its schedule cannot be replayed'
  if (estimate.basis === 'no-history') return history === 'error' ? 'none: no recorded run could be read to estimate from' : 'estimating…'
  if (task === null || task.phase === 'unknown' || task.start === null || task.end === null)
    return task?.phase === 'skipped' ? 'will not run: a task it needs did not succeed' : 'none: nothing places it in the schedule'
  if (task.expected === null) return 'none: with no recorded duration to go by, only its place in the schedule is known'
  const left = formatRough(max(0, task.end.mid - now))
  const range =
    formatRough(max(0, task.end.low - now)) === formatRough(max(0, task.end.high - now))
      ? ''
      : `, between ${formatRoughRange(max(0, task.end.low - now), max(0, task.end.high - now)).replace(' to ', ' and ')}`
  if (task.phase === 'running')
    return now >= task.end.high
      ? `past its usual duration: under way for about ${formatRough(now - task.start.mid)}, since about ${formatClock(task.start.mid)}`
      : `about ${left} left${range}; under way since about ${formatClock(task.start.mid)}`
  return task.start.mid <= now
    ? `expected to have started since the last read, and to end in about ${left}${range}`
    : `expected to start in about ${formatRough(task.start.mid - now)} and to end in about ${left}${range}`
}

/**
 * How a task's estimate was reached, for a reader who asks.
 * @param execution - The execution
 * @param estimate - The run's estimate
 * @param task - The task
 * @returns A few sentences
 */
function explain(execution: Execution, estimate: RunEstimate, task: ExecutionTask): string {
  const pace = estimate.pace[task.environment] ?? 1
  return [
    'The run reports a task only once it has ended, so when this one started is not measured.',
    'It is placed by replaying the scheduler from the tasks that have ended: a task starts when the tasks it needs have succeeded and a slot of its runner is free.',
    'Its end adds its usual duration to that start, and the range uses its shortest and its longest.',
    abs(pace - 1) < 0.05
      ? ''
      : `Durations are scaled by ${round(pace * 100) / 100}, the pace of the tasks that have ended on ${ENVIRONMENT_LABEL[task.environment]} so far.`,
    `Estimated when the run was last read, ${formatClock(execution.readAt)}, and redone at each read.`,
  ]
    .filter((sentence) => sentence !== '')
    .join(' ')
}

/**
 * The rows of a task's details that come from recorded runs: how long it usually takes and, for
 * a task that has not ended in a run under way, an ETA with how it was reached behind a disclosure.
 * @param props - See {@link TaskEstimateRowsProps}.
 * @param props.task
 * @param props.execution
 * @param props.estimate
 * @param props.history
 * @param props.now
 * @returns The rows, for a definition list
 */
export function TaskEstimateRows({ task, execution, estimate, history, now }: TaskEstimateRowsProps) {
  const estimated = estimate.tasks.get(taskKey(task.environment, task.id)) ?? null
  const pending = estimate.basis !== 'final' && estimate.basis !== 'no-plan' && estimated?.phase !== 'ended'
  return (
    <>
      {history === 'idle' && (estimated?.expected ?? null) === null ? null : (
        <>
          <dt className={TERM}>Usually</dt>
          <dd>{usually(task, estimated, history)}</dd>
        </>
      )}
      {pending ? (
        <>
          <dt className={TERM}>
            <abbr title="Estimated time to completion" className="no-underline">
              ETA
            </abbr>
          </dt>
          <dd>
            {eta(estimate, estimated, history, now)}
            {estimate.basis === 'estimated' && estimated !== null && estimated.start !== null ? (
              <details className="mt-0.5">
                <summary className="cursor-pointer select-none text-slate-500 underline-offset-2 hover:underline dark:text-slate-400">
                  How this is estimated
                </summary>
                <p className="mt-1 max-w-prose">{explain(execution, estimate, task)}</p>
              </details>
            ) : null}
          </dd>
        </>
      ) : null}
    </>
  )
}
