'use client'

import type { RunEstimate, TaskEstimate } from '@/lib/ci/estimate'
import type { ExecutionTask } from '@/lib/ci/execution'
import type { TaskGraph } from '@/lib/ci/projects'
import type { TaskRef } from './task-detail'
import { ringFraction, taskKey } from '@/lib/ci/estimate'
import { formatDuration, formatRough } from '@/lib/ci/pipeline-view'
import { STATE_COLOUR, STATE_LABEL, categoryOf } from '@/lib/ci/vocabulary'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { categoryPath } from './marks'

/** Props for {@link ChainGraph}. */
export interface ChainGraphProps {
  /** The chain's tasks laid out */
  graph: TaskGraph
  /** The selected task, or null */
  selected: TaskRef | null
  /** Selects a task */
  onSelect: (ref: TaskRef) => void
  /** The run's estimate, or null for a recorded run, where nothing is under way to outline */
  estimate: RunEstimate | null
  /** The time the outlines are drawn for */
  now: number
}

/** The distance between two columns. */
const COLUMN_W = 46

/** The distance between two rows. */
const ROW_H = 30

/** The radius of a node. */
const RADIUS = 10

/** The radius of the progress outline's centre line: a two-pixel stroke just clear of the node's own. */
const RING_RADIUS = RADIUS + 2.5

/** The left margin, with room for the stub of an external need. */
const LEFT = 18

/** The states drawn as a filled ring. */
const FILLED: readonly ExecutionTask['state'][] = ['success', 'failure', 'ready']

/**
 * One line about a task of the graph.
 * @param task - The task
 * @param external - The needs on other chains
 * @param estimate - What is estimated of it, or null
 * @param now - The current time
 * @returns The text
 */
function describe(task: ExecutionTask, external: readonly string[], estimate: TaskEstimate | null, now: number): string {
  const parts = [`${task.id}: ${STATE_LABEL[task.state]}`]
  if (task.durationMs !== null) parts.push(formatDuration(task.durationMs))
  if (estimate?.phase === 'running' && estimate.end !== null)
    parts.push(estimate.end.mid > now ? `ETA about ${formatRough(estimate.end.mid - now)}, estimated` : 'past its usual duration')
  if (task.needs.length > 0) parts.push(`after ${task.needs.join(', ')}`)
  if (external.length > 0) parts.push(`(${external.length} on other chains)`)
  if (task.detail !== null) parts.push(task.detail)
  return parts.join(' · ')
}

/**
 * A chain as a small graph: one node per task, left to right along its needs, each a ring
 * carrying its target's icon and its state, with a stub on the left for a need on another chain.
 * A task under way in a run being followed gains an outline that goes round from twelve o'clock
 * as its usual duration passes, closes when the run reports it succeeded, and then goes.
 * @param props - See {@link ChainGraphProps}.
 * @param props.graph
 * @param props.selected
 * @param props.onSelect
 * @param props.estimate
 * @param props.now
 * @returns The drawing
 */
export function ChainGraph({ graph, selected, onSelect, estimate, now }: ChainGraphProps) {
  const width = LEFT + max(1, graph.columns) * COLUMN_W
  const height = max(1, graph.rows) * ROW_H
  const centre = (column: number, row: number) => ({ cx: LEFT + column * COLUMN_W + RADIUS + 4, cy: row * ROW_H + ROW_H / 2 })
  const byId = createMap(graph.nodes.map((node) => [node.task.id, node] as const))
  return (
    <svg width={width} height={height} className="block max-w-full" role="list" aria-label={`${graph.nodes.length} tasks`}>
      {graph.edges.map((edge) => {
        const from = byId.get(edge.from)
        const to = byId.get(edge.to)
        if (from === undefined || to === undefined) return null
        const a = centre(from.column, from.row)
        const b = centre(to.column, to.row)
        const bend = (b.cx - a.cx) / 2
        return (
          <path
            key={`${edge.from}>${edge.to}`}
            d={`M${a.cx + RADIUS} ${a.cy} C${a.cx + RADIUS + bend} ${a.cy} ${b.cx - RADIUS - bend} ${b.cy} ${b.cx - RADIUS} ${b.cy}`}
            fill="none"
            stroke="var(--ci-line)"
            strokeWidth="1.5"
          />
        )
      })}
      {graph.nodes.map((node) => {
        const { task } = node
        const { cx, cy } = centre(node.column, node.row)
        const colour = STATE_COLOUR[task.state]
        const filled = FILLED.includes(task.state)
        const isSelected = selected?.id === task.id && selected.environment === task.environment
        const estimated = estimate?.tasks.get(taskKey(task.environment, task.id)) ?? null
        const fraction = ringFraction(estimated, now)
        return (
          <g
            key={task.id}
            role="listitem"
            tabIndex={0}
            aria-label={describe(task, node.externalNeeds, estimated, now)}
            onClick={() => onSelect({ id: task.id, environment: task.environment })}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelect({ id: task.id, environment: task.environment })
              }
            }}
            className={`cursor-pointer outline-none focus-visible:[&>circle:not(.ci-ring)]:stroke-[var(--ci-ink)] ${task.state === 'ready' && fraction === null ? 'ci-pulse' : ''}`}
          >
            <title>{describe(task, node.externalNeeds, estimated, now)}</title>
            {node.externalNeeds.length === 0 ? null : (
              <line
                x1={cx - RADIUS - 12}
                y1={cy}
                x2={cx - RADIUS}
                y2={cy}
                stroke="var(--ci-grid)"
                strokeWidth="1.5"
                strokeDasharray="2 2"
              />
            )}
            <circle
              cx={cx}
              cy={cy}
              r={RADIUS}
              fill={filled ? colour : 'var(--ci-surface)'}
              stroke={isSelected ? 'var(--ci-ink)' : colour}
              strokeWidth={isSelected ? 2.5 : 1.5}
              strokeDasharray={task.state === 'queued' ? '1.5 2' : task.state === 'blocked' ? '3 2' : undefined}
            />
            {estimate === null ? null : (
              <circle
                className="ci-ring"
                data-ring={fraction !== null ? 'running' : task.state === 'success' ? 'done' : 'idle'}
                cx={cx}
                cy={cy}
                r={RING_RADIUS}
                pathLength={100}
                transform={`rotate(-90 ${cx} ${cy})`}
                style={fraction === null ? undefined : { strokeDashoffset: 100 - fraction * 100 }}
              />
            )}
            <g transform={`translate(${cx - 6} ${cy - 6}) scale(0.5)`}>
              <path
                d={categoryPath(categoryOf(task.target))}
                fill="none"
                stroke={filled ? 'var(--ci-surface)' : colour}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          </g>
        )
      })}
    </svg>
  )
}
