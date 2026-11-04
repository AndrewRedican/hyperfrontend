'use client'

import type { Execution } from '@/lib/ci/execution'
import type { TimelineBar, TimelineLane } from '@/lib/ci/timeline'
import type { TaskRef } from './task-detail'
import { countStates } from '@/lib/ci/execution'
import { presentProject } from '@/lib/ci/labels'
import { formatClock, formatDuration } from '@/lib/ci/pipeline-view'
import { barsAt } from '@/lib/ci/timeline'
import { ENVIRONMENT_LABEL, categoryOf } from '@/lib/ci/vocabulary'
import { useMemo } from 'react'
import { OsIcon, StateMark, TargetIcon } from './marks'

/** Props for {@link MomentPanel}. */
export interface MomentPanelProps {
  /** The execution */
  execution: Execution
  /** Its lanes on the clock */
  lanes: readonly TimelineLane[]
  /** The time under the cursor, or null */
  time: number | null
  /** Whether the time is pinned rather than following the pointer */
  pinned: boolean
  /** The selected task, or null */
  selected: TaskRef | null
  /** Selects a task */
  onSelect: (ref: TaskRef) => void
}

/**
 * One moment of the run: every task under way across every runner at the time under the cursor.
 * @param props - See {@link MomentPanelProps}.
 * @param props.execution
 * @param props.lanes
 * @param props.time
 * @param props.pinned
 * @param props.selected
 * @param props.onSelect
 * @returns The panel
 */
export function MomentPanel({ execution, lanes, time, pinned, selected, onSelect }: MomentPanelProps) {
  const bars = useMemo(() => (time === null ? [] : barsAt(lanes, time)), [lanes, time])
  const pendingCounts = useMemo(() => countStates(lanes.flatMap((lane) => [...lane.unrun])), [lanes])
  const live = execution.status !== 'completed'
  const atEnd = time !== null && execution.clock.end !== null && time >= execution.clock.end - 1000
  return (
    <aside
      aria-label="At this moment"
      aria-live="polite"
      className="min-h-full rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900"
    >
      {time === null ? (
        <p className="text-slate-500 dark:text-slate-400">
          Move over the timeline, or tap it, to see what every runner was doing at that moment.
        </p>
      ) : (
        <>
          <p className="flex items-baseline justify-between gap-2 text-slate-900 dark:text-white">
            <span className="font-medium tabular-nums">
              {execution.clock.start === null ? formatClock(time) : `+${formatDuration(time - execution.clock.start)}`}
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              {formatClock(time)}
              {pinned ? ' · pinned' : ''}
            </span>
          </p>
          <p className="mt-0.5 text-slate-500 dark:text-slate-400">
            {bars.length === 0 ? 'nothing under way' : `${bars.length} task${bars.length === 1 ? '' : 's'} under way`}
          </p>
          <ul className="mt-2 space-y-2">
            {lanes.map((lane) => {
              const own = bars.filter((bar) => bar.task.environment === lane.lane.environment)
              const started = lane.lane.startedAt !== null && lane.lane.startedAt <= time
              const over = lane.lane.endedAt !== null && lane.lane.endedAt < time
              return (
                <li key={lane.lane.environment}>
                  <p className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                    <OsIcon environment={lane.lane.environment} className="h-3 w-3" />
                    {ENVIRONMENT_LABEL[lane.lane.environment]}
                    <span className="font-normal text-slate-500 dark:text-slate-400">
                      {!started ? 'not started' : over ? 'done' : own.length === 0 ? 'idle' : `${own.length} of ${lane.peak} slots`}
                    </span>
                  </p>
                  {own.length === 0 ? null : (
                    <ul className="mt-1 space-y-0.5">
                      {own.map((bar: TimelineBar) => {
                        const active = selected?.id === bar.task.id && selected.environment === bar.task.environment
                        return (
                          <li key={bar.task.id}>
                            <button
                              type="button"
                              onClick={() => onSelect({ id: bar.task.id, environment: bar.task.environment })}
                              className={`flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800 ${active ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
                              title={bar.task.id}
                            >
                              <StateMark state={bar.task.state} size={11} />
                              <TargetIcon category={categoryOf(bar.task.target)} className="h-3 w-3 text-slate-500" />
                              <span className="truncate font-mono text-slate-800 dark:text-slate-200">
                                {presentProject(bar.task.project).label}
                              </span>
                              <span className="truncate text-slate-500 dark:text-slate-400">{bar.task.target}</span>
                              <span className="ml-auto shrink-0 tabular-nums text-slate-500 dark:text-slate-400">
                                {formatDuration(time - bar.start)}/{formatDuration(bar.end - bar.start)}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
          {live && atEnd ? (
            <p className="mt-2 border-t border-slate-200 pt-2 text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Not ended yet: {pendingCounts.ready} running or waiting for a slot, {pendingCounts.blocked} waiting on a prerequisite,{' '}
              {pendingCounts.queued} not started. A running task is drawn once its check run reports it ended.
            </p>
          ) : null}
        </>
      )}
    </aside>
  )
}
