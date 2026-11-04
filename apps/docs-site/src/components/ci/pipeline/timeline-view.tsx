'use client'

import type { Execution, ExecutionTask } from '@/lib/ci/execution'
import type { TimeWindow, TimelineBar, TimelineLane, TimelineRow } from '@/lib/ci/timeline'
import type { Category } from '@/lib/ci/vocabulary'
import type { TaskRef } from './task-detail'
import type { CategoryCount } from './timeline-controls'
import { presentProject } from '@/lib/ci/labels'
import { formatClock, formatDuration, formatTick } from '@/lib/ci/pipeline-view'
import { fitWindow, panWindow, tickStep, tickTimes, timeToX, timelineLanes, xToTime, zoomOf, zoomWindow } from '@/lib/ci/timeline'
import { CATEGORIES, ENVIRONMENT_LABEL, STATE_COLOUR, STATE_LABEL, categoryOf } from '@/lib/ci/vocabulary'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { abs, exp, hypot, max, min, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { parseFloat } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { NodeIcon } from '../node-icon'
import { StateMark, osPath } from './marks'
import { MomentPanel } from './moment-panel'
import { TimelineControls } from './timeline-controls'

/** Props for {@link TimelineView}. */
export interface TimelineViewProps {
  /** The execution */
  execution: Execution
  /** The selected task, or null */
  selected: TaskRef | null
  /** Selects a task, or none */
  onSelect: (ref: TaskRef | null) => void
}

/** The height of the axis. */
const AXIS_H = 20

/** The height of a lane's header row. */
const LANE_H = 24

/** The height of a slot row. */
const SLOT_H = 14

/** The height of a chain row. */
const CHAIN_H = 18

/** The height of the stages row. */
const STAGE_H = 18

/** The space under the last row. */
const PAD = 6

/** How far a pointer moves before a press becomes a drag. */
const DRAG_THRESHOLD = 4

/** The rows placed, with the height they take. */
interface Placement {
  /** The rows */
  rows: Placed[]
  /** The total height */
  height: number
}

/** A bar under the pointer, with where the tooltip goes. */
interface HoveredBar {
  /** The bar */
  bar: TimelineBar
  /** The tooltip's left, relative to the chart */
  x: number
  /** The tooltip's top */
  y: number
}

/** What a press landed on: a task, a lane's header, or the plot. */
interface Pressed {
  /** The task, or null */
  task: TaskRef | null
  /** The lane whose header was pressed, or null */
  lane: string | null
}

/** A press that may become a drag. */
interface Drag {
  /** Where the press started, relative to the plot */
  x: number
  /** Whether it moved far enough to count as a drag */
  moved: boolean
  /** The window when the press started */
  window: TimeWindow
  /** What the press landed on */
  pressed: Pressed
}

/** Two fingers on the plot. */
interface Pinch {
  /** The distance between them when they landed */
  distance: number
  /** The window when they landed */
  window: TimeWindow
}

/** One row as it is placed. */
interface Placed {
  /** The lane */
  lane: TimelineLane
  /** The row, or null for the lane's header */
  row: TimelineRow | null
  /** The top */
  y: number
  /** The height */
  h: number
}

/** A pointer on the plot. */
interface Pointer {
  /** Its horizontal position, relative to the plot */
  x: number
  /** Its vertical position */
  y: number
}

/**
 * The categories an execution's tasks fall in, with their counts.
 * @param tasks - The tasks
 * @returns The categories present, in chain order
 */
function countCategories(tasks: readonly ExecutionTask[]): CategoryCount[] {
  const counts = createMap<Category, number>()
  for (const task of tasks) {
    const category = categoryOf(task.target)
    counts.set(category, (counts.get(category) ?? 0) + 1)
  }
  return CATEGORIES.filter((category) => counts.has(category)).map((category) => ({ category, count: counts.get(category) ?? 0 }))
}

/**
 * The rows of the chart, placed: each lane's header, then its slot rows or, when expanded, its chain rows.
 * @param lanes - The lanes
 * @param expanded - The environments shown by chain
 * @param top - Where the first lane starts
 * @returns The placed rows and the total height
 */
function place(lanes: readonly TimelineLane[], expanded: ReadonlySet<string>, top: number): Placement {
  const rows: Placed[] = []
  let y = top
  for (const lane of lanes) {
    rows.push({ lane, row: null, y, h: LANE_H })
    y += LANE_H
    const byChain = expanded.has(lane.lane.environment)
    for (const row of byChain ? lane.chains : lane.slots) {
      const h = byChain ? CHAIN_H : SLOT_H
      rows.push({ lane, row, y, h })
      y += h
    }
    y += 2
  }
  return { rows, height: y + PAD }
}

/**
 * What a lane's header says.
 * @param lane - The lane
 * @param execution - The execution
 * @returns `48 chains · 245 tasks · 78m 22s · peak 6`
 */
function laneSummary(lane: TimelineLane, execution: Execution): string {
  const tasks = lane.chains.reduce((count, row) => count + row.bars.length + row.unrun.length, 0)
  const job = lane.lane
  const end = job.endedAt ?? (job.status === 'running' ? execution.clock.end : null)
  const parts = [`${lane.chains.length} chains`, `${tasks} tasks`]
  if (job.startedAt !== null && end !== null) parts.push(formatDuration(end - job.startedAt))
  if (lane.peak > 0) parts.push(`peak ${lane.peak}`)
  if (lane.unrun.length > 0) parts.push(`${lane.unrun.length} not run`)
  if (job.status === 'queued') parts.push('not started')
  return parts.join(' · ')
}

/**
 * The run as a timeline on one clock: a lane per runner, each folded into its slots in use or
 * opened into one row per chain, every task that ran drawn where it ran, zoomable, pannable,
 * with a cursor naming what every runner was doing at a moment and the categories of target
 * lit up on demand.
 * @param props - See {@link TimelineViewProps}.
 * @param props.execution
 * @param props.selected
 * @param props.onSelect
 * @returns The view
 */
export function TimelineView({ execution, selected, onSelect }: TimelineViewProps) {
  const wrapper = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(800)
  const [window, setWindow] = useState<TimeWindow | null>(null)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(createSet())
  const [chosen, setChosen] = useState<ReadonlySet<Category>>(createSet())
  const [hoveredCategory, setHoveredCategory] = useState<Category | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [pinned, setPinned] = useState<number | null>(null)
  const [hoveredBar, setHoveredBar] = useState<HoveredBar | null>(null)
  const pointers = useRef(createMap<number, Pointer>())
  const drag = useRef<Drag | null>(null)
  const pinch = useRef<Pinch | null>(null)

  const lanes = useMemo(() => timelineLanes(execution), [execution])
  const tasks = useMemo(() => execution.chains.flatMap((chain) => [...chain.tasks]), [execution])
  const categories = useMemo(() => countCategories(tasks), [tasks])
  const clock = execution.clock
  const whole = fitWindow(clock)
  const view = window ?? whole
  const narrow = width < 560
  const labelW = narrow ? 76 : 132
  const plotW = max(50, width - labelW - 8)
  const { rows, height } = useMemo(
    () => place(lanes, expanded, AXIS_H + (execution.stages.length > 0 ? STAGE_H : 0)),
    [lanes, expanded, execution.stages.length]
  )
  const step = tickStep(view.end - view.start, plotW, narrow ? 56 : 72)
  const ticks = tickTimes(view, clock, step)
  const active = hoveredCategory !== null ? createSet([hoveredCategory]) : chosen.size === 0 ? null : chosen
  const cursor = pinned ?? hover
  const x = (time: number) => labelW + timeToX(time, view, plotW)
  const timeAt = (plotX: number) => min(view.end, max(view.start, xToTime(plotX, view, plotW)))

  useLayoutEffect(() => {
    const element = wrapper.current
    if (element === null) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(max(320, round(entry.contentRect.width)))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    setWindow(null)
    setPinned(null)
    setHover(null)
  }, [execution.run.id])

  const zoomAt = useCallback(
    (factor: number, anchor: number) =>
      setWindow((current) => zoomWindow(current ?? fitWindow(execution.clock), execution.clock, factor, anchor)),
    [execution.clock]
  )
  const panBy = useCallback(
    (deltaMs: number) => setWindow((current) => panWindow(current ?? fitWindow(execution.clock), execution.clock, deltaMs)),
    [execution.clock]
  )

  useEffect(() => {
    const element = wrapper.current
    if (element === null) return
    const onWheel = (event: WheelEvent): void => {
      const rect = element.getBoundingClientRect()
      const plotX = event.clientX - rect.left - labelW
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        // magic: 0.002 maps a wheel notch (~120 delta) to a 25% zoom change and keeps a trackpad pinch smooth
        zoomAt(exp(-event.deltaY * 0.002), min(1, max(0, plotX / plotW)))
      } else if (event.shiftKey || abs(event.deltaX) > abs(event.deltaY)) {
        event.preventDefault()
        const delta = event.shiftKey ? event.deltaY : event.deltaX
        panBy((delta / plotW) * (view.end - view.start))
      }
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [labelW, plotW, view.end, view.start, zoomAt, panBy])

  const toggleLane = (environment: string) =>
    setExpanded((current) => {
      const next = createSet(current)
      if (next.has(environment)) next.delete(environment)
      else next.add(environment)
      return next
    })
  const plotPoint = (event: React.PointerEvent): Pointer => {
    const rect = (event.currentTarget as Element).getBoundingClientRect()
    return { x: event.clientX - rect.left - labelW, y: event.clientY - rect.top }
  }
  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    const point = plotPoint(event)
    pointers.current.set(event.pointerId, point)
    // why: the chart captures the pointer so a drag keeps panning outside it, which sends the click to the chart; what was pressed is read here instead
    event.currentTarget.setPointerCapture(event.pointerId)
    if (pointers.current.size === 2) {
      const [first, second] = [...pointers.current.values()] as [Pointer, Pointer]
      pinch.current = { distance: max(1, hypot(first.x - second.x, first.y - second.y)), window: view }
      drag.current = null
      return
    }
    const target = event.target as Element
    const task = target.closest('[data-task]')
    const laneHeader = target.closest('[data-lane]')
    const environment = task?.getAttribute('data-environment') as TaskRef['environment'] | null | undefined
    drag.current = {
      x: point.x,
      moved: false,
      window: view,
      pressed: {
        task:
          task !== null && environment !== null && environment !== undefined
            ? { id: task.getAttribute('data-task') ?? '', environment }
            : null,
        lane: laneHeader?.getAttribute('data-lane') ?? null,
      },
    }
  }
  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const point = plotPoint(event)
    if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, point)
    if (pinch.current !== null && pointers.current.size === 2) {
      const [first, second] = [...pointers.current.values()] as [Pointer, Pointer]
      const distance = max(1, hypot(first.x - second.x, first.y - second.y))
      const middle = (first.x + second.x) / 2
      setWindow(zoomWindow(pinch.current.window, clock, distance / pinch.current.distance, min(1, max(0, middle / plotW))))
      return
    }
    if (drag.current !== null) {
      const dx = point.x - drag.current.x
      if (!drag.current.moved && abs(dx) < DRAG_THRESHOLD) return
      drag.current.moved = true
      setWindow(panWindow(drag.current.window, clock, (-dx / plotW) * (drag.current.window.end - drag.current.window.start)))
      setHoveredBar(null)
      return
    }
    if (event.pointerType === 'mouse' && point.x >= 0 && point.x <= plotW) setHover(timeAt(point.x))
    else if (event.pointerType === 'mouse') setHover(null)
  }
  const onPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    const point = plotPoint(event)
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    const press = drag.current
    drag.current = null
    if (press === null || press.moved) return
    if (press.pressed.lane !== null) {
      toggleLane(press.pressed.lane)
      return
    }
    if (press.pressed.task !== null) {
      onSelect(press.pressed.task)
      return
    }
    if (point.x < 0 || point.x > plotW) return
    // why: a tap or click on the plot pins the moment, a second one at the same place lets it go
    const time = timeAt(point.x)
    setPinned((current) => (current !== null && abs(x(current) - x(time)) < DRAG_THRESHOLD ? null : time))
  }
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const span = view.end - view.start
    const handlers: Record<string, () => void> = {
      '+': () => zoomAt(1.6, 0.5),
      '=': () => zoomAt(1.6, 0.5),
      '-': () => zoomAt(1 / 1.6, 0.5),
      '0': () => setWindow(null),
      ArrowLeft: () => panBy(-span / 10),
      ArrowRight: () => panBy(span / 10),
      Home: () => setWindow({ start: whole.start, end: whole.start + span }),
      End: () => setWindow({ start: whole.end - span, end: whole.end }),
      Escape: () => {
        setPinned(null)
        onSelect(null)
      },
    }
    const handler = handlers[event.key]
    if (handler === undefined) return
    event.preventDefault()
    handler()
  }

  const barStyle = (bar: TimelineBar) => {
    const colour = STATE_COLOUR[bar.task.state]
    const dim = active !== null && !active.has(categoryOf(bar.task.target))
    const isSelected = selected?.id === bar.task.id && selected.environment === bar.task.environment
    const isHovered = hoveredBar?.bar === bar
    return {
      fill: colour,
      fillOpacity: dim ? 0.1 : 1,
      stroke: isSelected || isHovered ? 'var(--ci-ink)' : dim ? colour : 'var(--ci-surface)',
      strokeWidth: isSelected ? 2 : 1,
      strokeOpacity: dim && !isSelected && !isHovered ? 0.7 : 1,
    }
  }

  return (
    <div className="ci-explorer">
      <TimelineControls
        categories={categories}
        selected={chosen}
        onToggle={(category) =>
          setChosen((current) => {
            const next = createSet(current)
            if (next.has(category)) next.delete(category)
            else next.add(category)
            return next
          })
        }
        onClear={() => setChosen(createSet())}
        onHover={setHoveredCategory}
        zoom={zoomOf(view, clock)}
        onZoom={(factor) => zoomAt(factor, cursor === null ? 0.5 : (cursor - view.start) / (view.end - view.start))}
        onFit={() => setWindow(null)}
      />
      <div className="mt-2 grid gap-3 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div
          ref={wrapper}
          tabIndex={0}
          role="group"
          aria-label={`Timeline of run #${execution.run.number}: ${lanes.length} runners, ${tasks.length} tasks. Plus and minus zoom, the arrows pan, zero fits, Escape clears.`}
          onKeyDown={onKeyDown}
          className="relative touch-none select-none overflow-hidden rounded-lg border border-slate-200 bg-white outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-slate-700 dark:bg-slate-900"
        >
          <svg
            width={width}
            height={height}
            className="block"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={() => {
              setHover(null)
              setHoveredBar(null)
            }}
          >
            <defs>
              <clipPath id={`plot-${execution.run.id}`}>
                <rect x={labelW} y={0} width={plotW} height={height} />
              </clipPath>
            </defs>
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={x(tick)} y1={AXIS_H - 4} x2={x(tick)} y2={height - PAD} stroke="var(--ci-line)" strokeDasharray="2 4" />
                <text x={x(tick)} y={AXIS_H - 7} textAnchor="middle" fontSize="10" fill="var(--ci-ink-2)">
                  {formatTick(tick - whole.start)}
                </text>
              </g>
            ))}
            {execution.stages.length === 0 ? null : (
              <g clipPath={`url(#plot-${execution.run.id})`}>
                {execution.stages.map((stage) => {
                  if (stage.startedAt === null) return null
                  const end = stage.endedAt ?? clock.end ?? stage.startedAt
                  return (
                    <g key={stage.name}>
                      <rect
                        x={x(stage.startedAt)}
                        y={AXIS_H + 3}
                        width={max(2, x(end) - x(stage.startedAt))}
                        height={STAGE_H - 6}
                        rx={2}
                        fill="var(--ci-node)"
                        stroke="var(--ci-line)"
                      />
                      <text
                        x={x(stage.startedAt) + 3}
                        y={AXIS_H + STAGE_H / 2 + 3.5}
                        fontSize="9"
                        fill="var(--ci-ink-2)"
                        className="pointer-events-none"
                      >
                        {stage.name}
                      </text>
                      <title>{`${stage.name} job: ${stage.conclusion ?? stage.status}${stage.endedAt === null ? '' : `, ${formatDuration(stage.endedAt - stage.startedAt)}`}`}</title>
                    </g>
                  )
                })}
              </g>
            )}
            {rows.map((placed) => {
              const { lane, row, y, h } = placed
              const environment = lane.lane.environment
              if (row === null) {
                const open = expanded.has(environment)
                const job = lane.lane
                const jobEnd = job.endedAt ?? (job.status === 'running' ? clock.end : null)
                return (
                  <g
                    key={environment}
                    role="button"
                    tabIndex={0}
                    aria-expanded={open}
                    aria-label={`${ENVIRONMENT_LABEL[environment]}: ${laneSummary(lane, execution)}. ${open ? 'Shown by chain' : 'Shown by slot'}; activate to switch.`}
                    data-lane={environment}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        toggleLane(environment)
                      }
                    }}
                    className="cursor-pointer outline-none focus-visible:[&>rect:first-child]:stroke-[var(--ci-ink)]"
                  >
                    <rect x={0} y={y} width={width} height={h} fill="var(--ci-node)" stroke="none" />
                    {job.startedAt !== null && jobEnd !== null ? (
                      <rect
                        x={x(job.startedAt)}
                        y={y + h - 3}
                        width={max(1, x(jobEnd) - x(job.startedAt))}
                        height={2}
                        fill="var(--ci-grid)"
                        opacity={0.5}
                        clipPath={`url(#plot-${execution.run.id})`}
                      />
                    ) : null}
                    <g
                      transform={`translate(6 ${y + 5})`}
                      fill="none"
                      stroke="var(--ci-ink)"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <OsGlyph environment={environment} />
                    </g>
                    <text x={24} y={y + h / 2 + 4} fontSize="11" fontWeight="600" fill="var(--ci-ink)">
                      {ENVIRONMENT_LABEL[environment]}
                    </text>
                    <text x={narrow ? 78 : 82} y={y + h / 2 + 4} fontSize={narrow ? 9 : 10} fill="var(--ci-ink-2)">
                      {narrow ? laneSummary(lane, execution).split(' · ').slice(1, 3).join(' · ') : laneSummary(lane, execution)}
                    </text>
                    <text x={width - 8} y={y + h / 2 + 4} fontSize="10" textAnchor="end" fill="var(--ci-ink-2)">
                      {narrow ? (open ? '▾' : '▸') : open ? '▾ fold into slots' : `▸ open ${lane.chains.length} chains`}
                    </text>
                  </g>
                )
              }
              const lastEnd = row.bars.reduce((end, bar) => max(end, bar.end), lane.lane.startedAt ?? whole.start)
              return (
                <g key={`${environment}:${row.key}`}>
                  {row.chain === null ? null : (
                    <g>
                      <NodeIcon kind={presentProject(row.chain.project).icon} x={8} y={y + (h - 11) / 2} size={11} />
                      <text x={23} y={y + h / 2 + 3.5} fontSize="10" fontFamily="var(--font-mono)" fill="var(--ci-ink)">
                        {presentProject(row.chain.project).label.slice(0, narrow ? 8 : 16)}
                        <title>{row.chain.project}</title>
                      </text>
                    </g>
                  )}
                  <g clipPath={`url(#plot-${execution.run.id})`}>
                    {row.bars.map((bar) => {
                      if (bar.end < view.start || bar.start > view.end) return null
                      const left = x(bar.start)
                      const barWidth = max(2, x(bar.end) - left)
                      return (
                        <rect
                          key={bar.task.id}
                          x={left}
                          y={y + 2}
                          width={barWidth}
                          height={h - 4}
                          rx={2}
                          {...barStyle(bar)}
                          className="cursor-pointer"
                          data-task={bar.task.id}
                          data-environment={bar.task.environment}
                          onPointerEnter={(event) => {
                            const rect = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
                            setHoveredBar({ bar, x: event.clientX - rect.left, y: y + h })
                          }}
                          onPointerLeave={() => setHoveredBar(null)}
                        >
                          <title>{describe(bar, clock.start)}</title>
                        </rect>
                      )
                    })}
                    {row.unrun.map((task, index) => {
                      const left = x(lastEnd) + 6 + index * 14
                      const colour = STATE_COLOUR[task.state]
                      const isSelected = selected?.id === task.id && selected.environment === task.environment
                      return (
                        <rect
                          key={task.id}
                          x={left}
                          y={y + 3}
                          width={10}
                          height={h - 6}
                          rx={2}
                          fill={task.state === 'ready' ? colour : 'none'}
                          fillOpacity={0.9}
                          stroke={isSelected ? 'var(--ci-ink)' : colour}
                          strokeWidth={isSelected ? 2 : 1}
                          strokeDasharray={task.state === 'queued' ? '1.5 2' : task.state === 'blocked' ? '3 2' : undefined}
                          className={`cursor-pointer ${task.state === 'ready' ? 'ci-pulse' : ''}`}
                          data-task={task.id}
                          data-environment={task.environment}
                        >
                          <title>{`${task.id}: ${STATE_LABEL[task.state]}${task.detail === null ? '' : ` (${task.detail})`}`}</title>
                        </rect>
                      )
                    })}
                  </g>
                </g>
              )
            })}
            {cursor === null || cursor < view.start || cursor > view.end ? null : (
              <g className="pointer-events-none">
                <line
                  x1={x(cursor)}
                  y1={AXIS_H - 2}
                  x2={x(cursor)}
                  y2={height - PAD}
                  stroke="var(--ci-ink)"
                  strokeWidth={pinned === null ? 1 : 1.5}
                  strokeDasharray={pinned === null ? '3 3' : undefined}
                />
                <rect x={min(width - 62, max(labelW, x(cursor) - 30))} y={1} width={60} height={13} rx={2} fill="var(--ci-ink)" />
                <text x={min(width - 32, max(labelW + 30, x(cursor)))} y={11} fontSize="9" textAnchor="middle" fill="var(--ci-surface)">
                  +{formatDuration(cursor - whole.start)}
                </text>
              </g>
            )}
          </svg>
          {hoveredBar === null ? null : (
            <div
              role="tooltip"
              className="pointer-events-none absolute z-10 max-w-64 rounded bg-slate-900/95 px-2 py-1.5 text-xs text-white shadow dark:bg-slate-100/95 dark:text-slate-900"
              style={{ left: min(max(0, hoveredBar.x - 100), width - 256), top: hoveredBar.y + 4 }}
            >
              <Hovered bar={hoveredBar.bar} start={clock.start} />
            </div>
          )}
        </div>
        {/* why: the inspector is taken out of the grid's flow on wide screens so the chart alone sets the row's height and the list scrolls inside it */}
        <div className="lg:relative lg:min-h-0">
          <div className="max-h-80 overflow-y-auto lg:absolute lg:inset-0 lg:max-h-none">
            <MomentPanel
              execution={execution}
              lanes={lanes}
              time={cursor}
              pinned={pinned !== null}
              selected={selected}
              onSelect={onSelect}
            />
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        <label className="flex w-full items-center gap-2 sm:w-auto sm:flex-1 sm:max-w-sm">
          <span className="shrink-0">Moment</span>
          <input
            type="range"
            min={whole.start}
            max={whole.end}
            step={1000}
            value={pinned ?? whole.start}
            onChange={(event) => setPinned(parseFloat(event.target.value))}
            aria-valuetext={pinned === null ? 'none' : `+${formatDuration(pinned - whole.start)}`}
            className="w-full"
          />
        </label>
        <span className="hidden sm:inline">
          Ctrl + scroll or pinch to zoom · drag to pan · click to pin a moment · click a task to open it
        </span>
        <span className="sm:hidden">Pinch to zoom · drag to pan · tap to pin a moment</span>
      </div>
    </div>
  )
}

/** Props for {@link OsGlyph}. */
interface OsGlyphProps {
  /** The environment */
  environment: ExecutionTask['environment']
}

/**
 * A platform icon drawn inside the chart, at 14 pixels.
 * @param props - See {@link OsGlyphProps}.
 * @param props.environment
 * @returns The strokes
 */
function OsGlyph({ environment }: OsGlyphProps) {
  return (
    <g transform="scale(0.58)">
      <path d={osPath(environment)} />
    </g>
  )
}

/**
 * One line about a bar.
 * @param bar - The bar
 * @param start - When the run started, or null
 * @returns The text
 */
function describe(bar: TimelineBar, start: number | null): string {
  const { task } = bar
  return `${task.id} on ${ENVIRONMENT_LABEL[task.environment]}: ${STATE_LABEL[task.state]} in ${formatDuration(bar.end - bar.start)}${start === null ? '' : `, from +${formatDuration(bar.start - start)}`}${task.detail === null ? '' : ` (${task.detail})`}`
}

/** Props for {@link Hovered}. */
interface HoveredProps {
  /** The bar */
  bar: TimelineBar
  /** When the run started, or null */
  start: number | null
}

/**
 * What the pointer is over, as a few lines.
 * @param props - See {@link HoveredProps}.
 * @param props.bar
 * @param props.start
 * @returns The lines
 */
function Hovered({ bar, start }: HoveredProps) {
  const { task } = bar
  return (
    <>
      <p className="flex items-center gap-1.5 font-mono">
        <StateMark state={task.state} size={11} />
        {task.id}
      </p>
      <p className="opacity-80">
        {ENVIRONMENT_LABEL[task.environment]} · {task.weight} slot · {STATE_LABEL[task.state]}
      </p>
      <p className="opacity-80">
        {formatClock(bar.start)} → {formatClock(bar.end)} · {formatDuration(bar.end - bar.start)}
        {start === null ? '' : ` · from +${formatDuration(bar.start - start)}`}
      </p>
      {task.needs.length === 0 ? null : (
        <p className="opacity-80">after {task.needs.length === 1 ? task.needs[0] : `${task.needs.length} tasks`}</p>
      )}
      {task.detail === null ? null : <p className="opacity-80">{task.detail}</p>}
    </>
  )
}
