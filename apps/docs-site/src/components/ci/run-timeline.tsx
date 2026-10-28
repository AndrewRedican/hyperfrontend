'use client'

import type { Outcome, TaskResult } from '@/lib/ci/model'
import type { Timeline, TimelineTask } from '@/lib/ci/pipeline-view'
import { presentProject } from '@/lib/ci/labels'
import { formatDuration, outcomeMark } from '@/lib/ci/pipeline-view'
import { useState } from 'react'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { NodeIcon } from './node-icon'

/** The colour variable of each outcome. */
export const OUTCOME_COLOUR: Record<Outcome, string> = {
  success: 'var(--ci-good)',
  failure: 'var(--ci-critical)',
  skipped: 'var(--ci-warning)',
  cancelled: 'var(--ci-serious)',
}

/** Props for {@link RunTimeline}. */
export interface RunTimelineProps {
  /** The environment's run on one clock */
  timeline: Timeline
  /** The selected task id, or null */
  selected: string | null
  /** Selects a task */
  onSelect: (task: TimelineTask | null) => void
}

/** The width of the chain labels. */
const LABEL_WIDTH = 180

/** The width of the bars. */
const PLOT_WIDTH = 820

/** The height of one chain row. */
const ROW_HEIGHT = 22

/** The height of the time axis. */
const AXIS_HEIGHT = 24

/**
 * The run of one environment as a timeline: one row per chain, one bar per task that ran, placed
 * on the run's clock and coloured by outcome; a task that never ran is a hollow mark at the end of
 * its row with its glyph.
 * @param props - See {@link RunTimelineProps}.
 * @param props.timeline - The run
 * @param props.selected - The selected task
 * @param props.onSelect - Told what was clicked
 * @returns The chart
 */
export function RunTimeline({ timeline, selected, onSelect }: RunTimelineProps) {
  const [hovered, setHovered] = useState<TimelineTask | null>(null)
  const span = max(1, timeline.end - timeline.start)
  const x = (time: number) => LABEL_WIDTH + ((time - timeline.start) / span) * PLOT_WIDTH
  const height = AXIS_HEIGHT + timeline.chains.length * ROW_HEIGHT + 8
  const ticks = tickTimes(span)
  return (
    <div className="ci-explorer relative mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <svg
        width={LABEL_WIDTH + PLOT_WIDTH + 24}
        height={height}
        role="img"
        aria-label={`${timeline.chains.length} chains on the ${timeline.environment} environment`}
        className="block"
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={x(timeline.start + tick)}
              y1={AXIS_HEIGHT - 4}
              x2={x(timeline.start + tick)}
              y2={height}
              stroke="var(--ci-line)"
              strokeDasharray="2 4"
            />
            <text x={x(timeline.start + tick)} y={AXIS_HEIGHT - 8} textAnchor="middle" fontSize="10" fill="var(--ci-ink-2)">
              {formatDuration(tick)}
            </text>
          </g>
        ))}
        {timeline.chains.map(({ chain, tasks }, row) => {
          const y = AXIS_HEIGHT + row * ROW_HEIGHT
          let unrun = 0
          const lastEnd = tasks.reduce((end, { result }) => max(end, result?.endedAt ?? timeline.start), timeline.start)
          return (
            <g key={`${chain.project}:${chain.environment}`}>
              <NodeIcon kind={presentProject(chain.project).icon} x={6} y={y + (ROW_HEIGHT - 13) / 2} size={13} />
              <text
                x={25}
                y={y + ROW_HEIGHT / 2}
                dominantBaseline="central"
                fontSize="11"
                fontFamily="var(--font-mono)"
                fill="var(--ci-ink)"
              >
                {presentProject(chain.project).label}
                <title>{chain.project}</title>
              </text>
              {tasks.map((entry) => {
                const { task, result } = entry
                const active = selected === task.id || hovered?.task.id === task.id
                if (result?.startedAt !== null && result?.startedAt !== undefined && result.endedAt !== null) {
                  const left = x(result.startedAt)
                  const width = max(3, x(result.endedAt) - left)
                  return (
                    <g
                      key={task.id}
                      className="cursor-pointer"
                      onPointerEnter={() => setHovered(entry)}
                      onPointerLeave={() => setHovered(null)}
                      onClick={() => onSelect(entry)}
                    >
                      <rect
                        x={left}
                        y={y + 4}
                        width={width}
                        height={ROW_HEIGHT - 8}
                        rx="3"
                        fill={OUTCOME_COLOUR[result.outcome]}
                        stroke={active ? 'var(--ci-ink)' : 'var(--ci-surface)'}
                        strokeWidth={active ? 1.5 : 1}
                      />
                      {width > 46 ? (
                        <text x={left + 4} y={y + ROW_HEIGHT / 2 + 4} fontSize="10" fill="#fff" className="pointer-events-none">
                          {task.target}
                        </text>
                      ) : null}
                      <title>{`${task.id}: ${outcomeMark(result.outcome).label} in ${formatDuration(result.durationMs)}`}</title>
                    </g>
                  )
                }
                unrun += 1
                const left = x(lastEnd) + 6 + (unrun - 1) * 18
                return (
                  <g
                    key={task.id}
                    className="cursor-pointer"
                    onPointerEnter={() => setHovered(entry)}
                    onPointerLeave={() => setHovered(null)}
                    onClick={() => onSelect(entry)}
                  >
                    <rect
                      x={left}
                      y={y + 5}
                      width="14"
                      height={ROW_HEIGHT - 10}
                      rx="3"
                      fill="none"
                      stroke={result === null ? 'var(--ci-ink-2)' : OUTCOME_COLOUR[result.outcome]}
                      strokeWidth={active ? 2 : 1}
                    />
                    <text
                      x={left + 7}
                      y={y + ROW_HEIGHT / 2 + 3.5}
                      textAnchor="middle"
                      fontSize="9"
                      fill={result === null ? 'var(--ci-ink-2)' : OUTCOME_COLOUR[result.outcome]}
                      className="pointer-events-none"
                    >
                      {outcomeMark(result?.outcome ?? null).glyph}
                    </text>
                    <title>{`${task.id}: ${outcomeMark(result?.outcome ?? null).label}${result?.detail === null || result?.detail === undefined ? '' : ` (${result.detail})`}`}</title>
                  </g>
                )
              })}
            </g>
          )
        })}
      </svg>
      {hovered === null ? null : (
        <div className="pointer-events-none absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded bg-slate-900/90 px-2 py-1 font-mono text-xs text-white dark:bg-slate-100/90 dark:text-slate-900">
          {describe(hovered.task.id, hovered.result)}
        </div>
      )}
    </div>
  )
}

/**
 * One line about a task.
 * @param id - The task id
 * @param result - Its result, or null
 * @returns The text
 */
function describe(id: string, result: TaskResult | null): string {
  if (result === null) return `${id} · no result in the record`
  const mark = outcomeMark(result.outcome)
  return `${id} · ${mark.glyph} ${mark.label}${result.startedAt === null ? '' : ` in ${formatDuration(result.durationMs)}`}${result.detail === null ? '' : ` · ${result.detail}`}`
}

/**
 * The offsets at which the axis is marked: about eight ticks on round numbers of seconds or minutes.
 * @param span - The run's length, in milliseconds
 * @returns The offsets from the start
 */
function tickTimes(span: number): number[] {
  const steps = [5_000, 10_000, 30_000, 60_000, 120_000, 300_000, 600_000, 900_000, 1_800_000]
  const step = steps.find((candidate) => span / candidate <= 8) ?? 3_600_000
  const ticks: number[] = []
  for (let tick = 0; tick <= span; tick += step) ticks.push(tick)
  return ticks
}
