'use client'

import type { RunEstimate } from '@/lib/ci/estimate'
import type { Execution } from '@/lib/ci/execution'
import type { Environment } from '@/lib/ci/model'
import type { HistoryState } from './use-history'
import { progressAt } from '@/lib/ci/estimate'
import { allTasks, countStates } from '@/lib/ci/execution'
import { formatClock, formatClockShort, formatDuration, formatRough, formatRoughRange } from '@/lib/ci/pipeline-view'
import { ENVIRONMENT_LABEL, STATE_COLOUR } from '@/lib/ci/vocabulary'
import { useMemo } from 'react'
import { abs, max, min, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { stateOfRun } from './marks'

/** Props for {@link RunProgress}. */
export interface RunProgressProps {
  /** The execution */
  execution: Execution
  /** Its estimate */
  estimate: RunEstimate
  /** Where the history behind the estimate stands */
  history: HistoryState
  /** The current time */
  now: number
}

/** How far a runner's pace must be from its usual one before it is worth a sentence. */
const PACE_WORTH_SAYING = 0.05

/**
 * Why a run under way has no estimate.
 * @param estimate - The estimate
 * @param history - Where the history stands
 * @returns A few words, or null when there is an estimate or the reason needs none
 */
function missing(estimate: RunEstimate, history: HistoryState): string | null {
  if (estimate.basis === 'truncated') return 'no ETA: the live plan dropped its dependencies to fit, so its schedule cannot be replayed'
  if (estimate.basis !== 'no-history') return null
  if (history === 'loading' || history === 'idle') return 'estimating from the recorded runs…'
  return 'no ETA: no recorded run could be read to estimate from'
}

/**
 * How an estimate was reached, for a reader who asks.
 * @param estimate - The estimate
 * @returns A few sentences
 */
function explain(estimate: RunEstimate): string {
  const paces = (entries(estimate.pace) as [Environment, number][])
    .filter(([, pace]) => abs(pace - 1) >= PACE_WORTH_SAYING)
    .map(([environment, pace]) => `${round(pace * 100) / 100}× on ${ENVIRONMENT_LABEL[environment]}`)
  return [
    'The run reports a task only once it has ended, and this page reads the run again every minute or more, so nothing here is measured live.',
    `What has not ended is placed by replaying the scheduler from what has: a task starts when the tasks it needs have succeeded and a slot of its runner is free, and takes the middle of its durations in the ${estimate.runs} recorded ${estimate.runs === 1 ? 'run' : 'runs'} before this one.`,
    'The range replays every task at its shortest and at its longest recorded duration, and narrows as tasks end.',
    paces.length === 0
      ? ''
      : `So far the tasks that ended took ${paces.join(' and ')} their usual durations, and what is left is scaled to match.`,
    estimate.unknown === 0
      ? ''
      : `${estimate.unknown} ${estimate.unknown === 1 ? 'task has' : 'tasks have'} no recorded run and count as no time, so the ETA is a lower bound.`,
    estimate.unstarted.length === 0
      ? ''
      : `${estimate.unstarted.map((environment) => ENVIRONMENT_LABEL[environment]).join(' and ')} had started no task, and no record times a runner's setup, so the ETA is a lower bound.`,
    'A green outline round a task shows how far through its usual duration it is, and closes only when the run reports the task ended.',
    `Estimated when the run was last read, ${formatClock(estimate.asOf)}.`,
  ]
    .filter((sentence) => sentence !== '')
    .join(' ')
}

/**
 * The run's progress in one strip: how many tasks ended, how long it has run, and, while it runs,
 * an estimate of what is left with its range, drawn as the elapsed share of the expected whole
 * with the span the finish is expected in. A run that ended shows what it took instead.
 * @param props - See {@link RunProgressProps}.
 * @param props.execution
 * @param props.estimate
 * @param props.history
 * @param props.now
 * @returns The strip
 */
export function RunProgress({ execution, estimate, history, now }: RunProgressProps) {
  const counts = useMemo(() => countStates(allTasks(execution)), [execution])
  const total =
    counts.success + counts.failure + counts.skipped + counts.cancelled + counts.queued + counts.blocked + counts.ready + counts.unknown
  const ended = counts.success + counts.failure + counts.skipped + counts.cancelled
  const start = execution.clock.start
  const progress = progressAt(estimate, start, now)
  const final = estimate.basis === 'final'
  const estimated = estimate.basis === 'estimated' && progress !== null && estimate.finish !== null && start !== null
  const whole = estimated ? max(estimate.finish?.high ?? now, now) - (start ?? now) : 1
  const share = (time: number): number => min(100, max(0, ((time - (start ?? time)) / max(1, whole)) * 100))
  const fraction = final ? 1 : estimated ? share(now) / 100 : ended / max(1, total)
  const parts = [`${ended}/${total} tasks ended`]
  if (final && progress !== null)
    parts.push(
      execution.status === 'completed'
        ? `took ${formatDuration(progress.elapsedMs)}`
        : `in ${formatDuration(progress.elapsedMs)}; the closing jobs are still running`
    )
  else if (start !== null) parts.push(`${formatRough(max(0, now - start))} elapsed`)
  if (estimated && estimate.finish !== null) {
    parts.push(
      progress.remaining === null
        ? `past its ETA: the recorded runs put its end by ${formatClockShort(estimate.finish.high)}`
        : `ETA ${estimate.floor ? 'at least' : 'about'} ${formatRough(progress.remaining.mid)}${
            formatRough(progress.remaining.low) === formatRough(progress.remaining.high)
              ? ''
              : ` (${formatRoughRange(progress.remaining.low, progress.remaining.high)})`
          }, around ${formatClockShort(max(estimate.finish.mid, now))}`
    )
  }
  const reason = final ? null : missing(estimate, history)
  if (reason !== null) parts.push(reason)
  const text = parts.join(' · ')
  return (
    <div className="text-xs text-slate-600 dark:text-slate-400">
      <div
        role="progressbar"
        aria-label="Progress of the run"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={round(fraction * 100)}
        aria-valuetext={text}
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
      >
        {estimated && estimate.finish !== null ? (
          <span
            className="ci-eta-band absolute inset-y-0"
            style={{ left: `${share(max(estimate.finish.low, now))}%`, right: 0 }}
            title="The span the run is expected to end in"
          />
        ) : null}
        <span
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
          style={{
            width: `${fraction * 100}%`,
            background: final ? STATE_COLOUR[stateOfRun('completed', execution.outcome ?? execution.conclusion)] : 'var(--ci-series-1)',
          }}
        />
      </div>
      <p className="mt-1 tabular-nums">{text}</p>
      {estimate.basis === 'estimated' ? (
        <details className="mt-0.5">
          <summary className="cursor-pointer select-none text-slate-500 underline-offset-2 hover:underline dark:text-slate-400">
            How the ETA is estimated
          </summary>
          <p className="mt-1 max-w-prose">{explain(estimate)}</p>
        </details>
      ) : null}
    </div>
  )
}
