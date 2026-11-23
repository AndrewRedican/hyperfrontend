import type { Execution, ExecutionTask } from './execution'
import type { Environment, RunRecord, Weight } from './model'
import type { RunSummary } from './run-browser'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { floor, max, min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { ENDED_STATES } from './vocabulary'

/** How many of a task's most recent runs its expected duration is drawn from. */
export const TASK_SAMPLES = 5

/** The fewest runs of a target, over every project, that stand in for a task no record has run. */
export const TARGET_SAMPLES = 3

/** How far round its circle a running task's outline may go before the run reports the task ended. */
export const RING_CAP = 0.95

/** magic: the expected work a runner's ended tasks must far exceed before its pace counts in full; ten minutes kept the first quarter of seven recorded runs from being bent by a few short tasks. */
export const PACE_PRIOR_MS = 600_000

/** The narrowest and the widest pace applied, so a few odd tasks cannot bend the whole estimate. */
const PACE_BOUNDS = [0.5, 2] as const

/** How long before its recorded start a task is counted as holding its slot: the scheduler starts it a moment after the slot is freed. */
const START_SLACK_MS = 1_000

/** A low, a middle and a high value of one quantity. */
export interface Range {
  /** The low value */
  low: number
  /** The middle value */
  mid: number
  /** The high value */
  high: number
}

/** How long a task is expected to run, from the recorded runs. */
export interface Expectation extends Range {
  /** How many recorded durations it is drawn from */
  samples: number
  /** Whether they are runs of the task itself on its environment, or of its target over every project there */
  basis: 'task' | 'target'
}

/** How many tasks of each weight an environment runs at once. */
export type SlotBudget = Record<Weight, number>

/** What some recorded runs say about how long tasks take and how many run at once. */
export interface DurationHistory {
  /** How many records it is drawn from */
  runs: number
  /** The durations of each task that succeeded, newest first, by {@link taskKey} */
  byTask: ReadonlyMap<string, readonly number[]>
  /** The durations of each target that succeeded, ascending, by environment and target */
  byTarget: ReadonlyMap<string, readonly number[]>
  /** The slots each environment was seen to use */
  slots: Partial<Record<Environment, SlotBudget>>
}

/**
 * Where a task stands in an estimate: `ended` with a result, `running` when the replayed schedule
 * had started it by the time the run was read, `waiting` when it starts later, `skipped` when a task
 * it needs did not succeed, and `unknown` when nothing says.
 */
export type TaskPhase = 'ended' | 'running' | 'waiting' | 'skipped' | 'unknown'

/** What is estimated of one task. */
export interface TaskEstimate {
  /** Where it stands */
  phase: TaskPhase
  /** How long it is expected to run, or null when no record says */
  expected: Expectation | null
  /** When it started or is expected to start, inferred from the schedule; null for an ended task or one that will not run */
  start: Range | null
  /** When it is expected to end; null for an ended task or one that will not run */
  end: Range | null
}

/**
 * How far an estimate goes: `final` for a run that has ended, `estimated` for one under way, and
 * otherwise why there is none: no history read, a plan without its dependencies, or no plan at all.
 */
export type EstimateBasis = 'final' | 'estimated' | 'no-history' | 'truncated' | 'no-plan'

/** What is estimated of a run. */
export interface RunEstimate {
  /** How far the estimate goes */
  basis: EstimateBasis
  /** When the run was read: what had ended by then is fact, the rest is estimated */
  asOf: number
  /** Every task's estimate, by {@link taskKey} */
  tasks: ReadonlyMap<string, TaskEstimate>
  /** When the last task is expected to end, or null without an estimate */
  finish: Range | null
  /** How many tasks still to run have no expected duration and are counted as taking no time */
  unknown: number
  /** Each runner's pace so far: how long its ended tasks took over how long they were expected to, held near one until enough work has ended */
  pace: Partial<Record<Environment, number>>
  /** The runners that had started none of their tasks, whose setup no record times */
  unstarted: readonly Environment[]
  /** Whether the finish is a lower bound: a task has no expected duration, or a runner has not started its tasks */
  floor: boolean
  /** How many recorded runs the expectations are drawn from */
  runs: number
}

/** How many recorded runs a history is drawn from. */
export const HISTORY_RUNS = 5

/**
 * The recorded runs a run's history is drawn from: the most recent ones that started before it.
 *
 * @param runs - Every run known
 * @param selected - The run to estimate
 * @returns Their ids, newest first, at most {@link HISTORY_RUNS}
 */
export function historyRunsFor(runs: readonly RunSummary[], selected: RunSummary): number[] {
  return runs
    .filter((run) => run.recorded && run.id !== selected.id && run.at < selected.at)
    .sort((a, b) => b.at - a.at)
    .slice(0, HISTORY_RUNS)
    .map((run) => run.id)
}

/**
 * The key of a task in an estimate and in a history.
 *
 * @param environment - Where the task runs
 * @param id - `<project>:<target>`
 * @returns The two joined
 */
export function taskKey(environment: Environment, id: string): string {
  return `${environment} ${id}`
}

/**
 * The value a fraction of the way through some ascending numbers, between two of them when it falls there.
 *
 * @param sorted - The numbers, ascending, at least one
 * @param fraction - From zero for the first to one for the last
 * @returns The value there
 */
export function quantile(sorted: readonly number[], fraction: number): number {
  const position = (sorted.length - 1) * fraction
  const below = sorted[floor(position)] as number
  const above = sorted[min(sorted.length - 1, floor(position) + 1)] as number
  return below + (above - below) * (position - floor(position))
}

/**
 * The most spans under way at once.
 *
 * @param spans - Start and end pairs
 * @returns The peak, zero for none
 */
function peakOf(spans: readonly (readonly [number, number])[]): number {
  const changes = spans.flatMap(([start, end]) => [[start, 1] as const, [end, -1] as const]).sort((a, b) => a[0] - b[0] || a[1] - b[1])
  let current = 0
  let peak = 0
  for (const [, change] of changes) {
    current += change
    peak = max(peak, current)
  }
  return peak
}

/**
 * The count seen most often, the larger of two seen equally often.
 *
 * @param counts - Some counts, zeros ignored
 * @returns The count, or null when every one is zero
 */
function commonest(counts: readonly number[]): number | null {
  const seen = createMap<number, number>()
  for (const count of counts) if (count > 0) seen.set(count, (seen.get(count) ?? 0) + 1)
  return [...seen].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? null
}

/**
 * What some records say about durations and slots: each task's most recent successful runs, each
 * target's over every project, and the slots each environment used. A publish is timed from when
 * the other environments ended, since until then it only waits for them.
 *
 * @param records - The records, newest first
 * @returns Each task's and each target's durations, with the slots every environment used
 */
export function historyOf(records: readonly RunRecord[]): DurationHistory {
  const byTask = createMap<string, number[]>()
  const byTarget = createMap<string, number[]>()
  const peaks = createMap<Environment, SlotBudget[]>()
  for (const record of records) {
    for (const results of values(record.results)) {
      const { environment } = results
      const gate = max(0, ...values(record.results).map((other) => (other.environment === environment ? 0 : other.endedAt)))
      const weights = createMap(
        record.plan.chains
          .filter((chain) => chain.environment === environment)
          .flatMap((chain) => chain.tasks.map((task) => [task.id, task.weight]))
      )
      const spans: Record<Weight, [number, number][]> = { light: [], heavy: [] }
      for (const task of results.tasks) {
        if (task.startedAt === null || task.endedAt === null) continue
        spans[weights.get(task.id) ?? 'light'].push([task.startedAt, task.endedAt])
        if (task.outcome !== 'success') continue
        const duration = task.endedAt - (task.target === 'publish' ? min(task.endedAt, max(task.startedAt, gate)) : task.startedAt)
        const own = byTask.get(taskKey(environment, task.id)) ?? []
        if (own.length < TASK_SAMPLES) byTask.set(taskKey(environment, task.id), [...own, duration])
        byTarget.set(taskKey(environment, task.target), [...(byTarget.get(taskKey(environment, task.target)) ?? []), duration])
      }
      peaks.set(environment, [...(peaks.get(environment) ?? []), { light: peakOf(spans.light), heavy: peakOf(spans.heavy) }])
    }
  }
  const slots: Partial<Record<Environment, SlotBudget>> = {}
  for (const [environment, seen] of peaks) {
    const light = commonest(seen.map((peak) => peak.light))
    if (light !== null) slots[environment] = { light, heavy: commonest(seen.map((peak) => peak.heavy)) ?? 1 }
  }
  for (const durations of byTarget.values()) durations.sort((a, b) => a - b)
  return { runs: records.length, byTask, byTarget, slots }
}

/**
 * How long a task is expected to run: the middle of its own recent runs with their shortest and
 * longest, or, when no record ran it, the middle half of its target's runs over every project.
 *
 * @param history - What the recorded runs say
 * @param task - The task whose duration is asked for
 * @returns The expectation, or null when the records hold too little
 */
export function expectationOf(history: DurationHistory, task: Pick<ExecutionTask, 'id' | 'target' | 'environment'>): Expectation | null {
  const own = [...(history.byTask.get(taskKey(task.environment, task.id)) ?? [])].sort((a, b) => a - b)
  if (own.length > 0)
    return { low: own[0] as number, mid: quantile(own, 0.5), high: own[own.length - 1] as number, samples: own.length, basis: 'task' }
  const target = history.byTarget.get(taskKey(task.environment, task.target)) ?? []
  if (target.length < TARGET_SAMPLES) return null
  return { low: quantile(target, 0.25), mid: quantile(target, 0.5), high: quantile(target, 0.75), samples: target.length, basis: 'target' }
}

/** A task as the replay takes it. */
interface Replayed {
  /** The task */
  task: ExecutionTask
  /** The rank of its chain */
  order: number
  /** When its chain's first task started, or null while the chain has not started */
  opened: number | null
  /** How long it is taken to run */
  duration: number
}

/** When something starts and ends. */
interface Span {
  /** The start */
  start: number
  /** The end */
  end: number
}

/** A task holding a slot. */
interface Holding extends Span {
  /** The task id */
  id: string
  /** The slot */
  weight: Weight
}

/**
 * One environment's schedule replayed: the tasks that ended keep the times the run reported, and
 * every other task starts as the scheduler would start it, the moment what it needs has succeeded
 * and a slot of its weight is free, by its chain's rank. A task the run has not reported cannot
 * end before the run was read, a chain that had not started starts no task before then, and a
 * publish does not begin its work before the gate opens.
 *
 * @param tasks - The environment's tasks
 * @param budget - The slots
 * @param asOf - When the run was read
 * @param gate - When the other environments end, for a publish
 * @returns The span of each task that had not ended, or null for one that will not run
 */
function replay(tasks: readonly Replayed[], budget: SlotBudget, asOf: number, gate: number): Map<string, Span | null> {
  const ids = createSet(tasks.map((entry) => entry.task.id))
  const doneAt = createMap<string, number>()
  const failed = createSet<string>()
  const pinned: Holding[] = []
  const pending = createMap<string, Replayed>()
  for (const entry of tasks) {
    const { task } = entry
    if (task.startedAt !== null && task.endedAt !== null)
      pinned.push({ id: task.id, weight: task.weight, start: task.startedAt, end: task.endedAt })
    if (task.state === 'success') doneAt.set(task.id, task.endedAt ?? 0)
    else if (ENDED_STATES.includes(task.state)) failed.add(task.id)
    else pending.set(task.id, entry)
  }
  const past = [
    ...createSet([
      asOf,
      ...pinned.flatMap((held) => [held.start, held.end]),
      ...tasks.flatMap((entry) => (entry.opened === null ? [] : [entry.opened])),
    ]),
  ]
    .filter((moment) => moment <= asOf)
    .sort((a, b) => a - b)
  const spans = createMap<string, Span | null>()
  let running: Holding[] = []
  let now = past[0] as number
  for (;;) {
    for (const held of running) if (held.end <= now) doneAt.set(held.id, held.end)
    running = running.filter((held) => held.end > now)
    for (let settled = false; !settled; ) {
      settled = true
      for (const { task } of [...pending.values()]) {
        if (!task.needs.some((need) => failed.has(need))) continue
        pending.delete(task.id)
        failed.add(task.id)
        spans.set(task.id, null)
        settled = false
      }
    }
    const ready = [...pending.values()]
      .filter((entry) => now >= asOf || (entry.opened !== null && now >= entry.opened))
      .filter((entry) => entry.task.needs.every((need) => !ids.has(need) || (doneAt.get(need) ?? now + 1) <= now))
      .sort((a, b) => a.order - b.order || (a.task.id < b.task.id ? -1 : 1))
    for (const { task, duration } of ready) {
      const { weight } = task
      const held = pinned.filter((item) => item.weight === weight && item.start - START_SLACK_MS <= now && now < item.end).length
      if (held + running.filter((item) => item.weight === weight).length >= budget[weight]) continue
      const end = max((task.target === 'publish' ? max(now, gate) : now) + duration, asOf)
      spans.set(task.id, { start: now, end })
      running.push({ id: task.id, weight, start: now, end })
      pending.delete(task.id)
    }
    const next = [...past.filter((moment) => moment > now).slice(0, 1), ...running.map((held) => held.end)]
    if (next.length === 0) break
    now = max(now, min(...next))
  }
  return spans
}

/**
 * Three values in ascending order as a range.
 *
 * @param trio - The low, middle and high scenario's values
 * @returns The smallest as the low value, the largest as the high
 */
function rangeOf(trio: readonly number[]): Range {
  const [low, mid, high] = [...trio].sort((a, b) => a - b) as [number, number, number]
  return { low, mid, high }
}

/** The scenarios an estimate is replayed under: every task at its low, its middle or its high expectation. */
const SCENARIOS = ['low', 'mid', 'high'] as const

/**
 * What can be estimated of a run from recorded runs: each task's expected duration and, for a run
 * under way, when each remaining task starts and ends and when the last one does, by replaying
 * every environment's schedule under a low, a middle and a high scenario. Nothing is estimated
 * for a run that has ended, without a history, or from a plan that dropped its dependencies.
 *
 * @param execution - The run, as it was last read
 * @param history - The history, or null when none was read
 * @returns Every task's expectation and, for a run under way, where each stands and when the last ends
 */
export function estimateRun(execution: Execution, history: DurationHistory | null): RunEstimate {
  const tasks = createMap<string, TaskEstimate>()
  const asOf = execution.readAt
  for (const chain of execution.chains) {
    for (const task of chain.tasks) {
      const expected = history === null ? null : expectationOf(history, task)
      tasks.set(taskKey(task.environment, task.id), {
        phase: ENDED_STATES.includes(task.state) ? 'ended' : 'unknown',
        expected,
        start: null,
        end: null,
      })
    }
  }
  const none = (basis: EstimateBasis, finish: Range | null = null): RunEstimate => ({
    basis,
    asOf,
    tasks,
    finish,
    unknown: 0,
    pace: {},
    unstarted: [],
    floor: false,
    runs: history?.runs ?? 0,
  })
  if (execution.status === 'completed' || (execution.lanes.length > 0 && execution.lanes.every((lane) => lane.status === 'completed'))) {
    const end = execution.lanes.reduce<number | null>(
      (latest, lane) => (lane.endedAt === null ? latest : max(latest ?? 0, lane.endedAt)),
      null
    )
    return none('final', end === null ? null : { low: end, mid: end, high: end })
  }
  if (execution.plan === null || execution.chains.length === 0) return none('no-plan')
  if (execution.plan.truncated) return none('truncated')
  if (history === null || history.runs === 0) return none('no-history')

  const ends = createMap<Environment, number[]>()
  const pace: Partial<Record<Environment, number>> = {}
  let unknown = 0
  const unstarted: Environment[] = []
  const open = execution.lanes.filter((lane) => lane.status !== 'completed')
  for (const lane of execution.lanes)
    if (lane.status === 'completed' && lane.endedAt !== null) ends.set(lane.environment, [lane.endedAt, lane.endedAt, lane.endedAt])
  const publishes = (environment: Environment): boolean =>
    execution.chains.some((chain) => chain.environment === environment && chain.tasks.some((task) => task.target === 'publish'))
  // why: a publish waits for the other environments, so theirs are replayed first and their ends are its gate
  for (const lane of [...open.filter((lane) => !publishes(lane.environment)), ...open.filter((lane) => publishes(lane.environment))]) {
    const chains = execution.chains.filter((chain) => chain.environment === lane.environment)
    const ran = chains.flatMap((chain) => chain.tasks.filter((task) => task.startedAt !== null && task.endedAt !== null))
    const seen: SlotBudget = {
      light: peakOf(ran.filter((task) => task.weight === 'light').map((task) => [task.startedAt as number, task.endedAt as number])),
      heavy: peakOf(ran.filter((task) => task.weight === 'heavy').map((task) => [task.startedAt as number, task.endedAt as number])),
    }
    const known = history.slots[lane.environment]
    const budget: SlotBudget = { light: max(1, seen.light, known?.light ?? 0), heavy: max(1, seen.heavy, known?.heavy ?? 0) }
    if (chains.every((chain) => chain.status === 'queued')) unstarted.push(lane.environment)
    const measured = ran
      .filter((task) => task.state === 'success' && task.target !== 'publish')
      .flatMap((task) => {
        const expected = tasks.get(taskKey(task.environment, task.id))?.expected ?? null
        return expected === null ? [] : [[(task.endedAt as number) - (task.startedAt as number), expected.mid] as const]
      })
    const scale = min(
      PACE_BOUNDS[1],
      max(
        PACE_BOUNDS[0],
        (measured.reduce((sum, [took]) => sum + took, 0) + PACE_PRIOR_MS) /
          (measured.reduce((sum, [, mid]) => sum + mid, 0) + PACE_PRIOR_MS)
      )
    )
    pace[lane.environment] = scale
    const scenarios = SCENARIOS.map((scenario, index) => {
      const gate = max(0, ...[...ends].filter(([environment]) => environment !== lane.environment).map(([, trio]) => trio[index] as number))
      return replay(
        chains.flatMap((chain) =>
          chain.tasks.map((task) => ({
            task,
            order: chain.order,
            opened: chain.status === 'queued' ? null : chain.startedAt,
            duration: (tasks.get(taskKey(task.environment, task.id))?.expected?.[scenario] ?? 0) * scale,
          }))
        ),
        budget,
        asOf,
        gate
      )
    })
    const last = ran.map((task) => task.endedAt as number)
    const laneEnds = scenarios.map((spans) => max(0, ...last, ...[...spans.values()].map((span) => span?.end ?? 0)))
    if (laneEnds.every((end) => end > 0)) ends.set(lane.environment, laneEnds)
    for (const chain of chains) {
      for (const task of chain.tasks) {
        const key = taskKey(task.environment, task.id)
        const estimate = tasks.get(key) as TaskEstimate
        if (estimate.phase === 'ended' || !scenarios[1]?.has(task.id)) continue
        const spans = scenarios.map((scenario) => scenario.get(task.id) ?? null)
        if (spans.some((span) => span === null)) {
          tasks.set(key, { ...estimate, phase: 'skipped' })
          continue
        }
        if (estimate.expected === null) unknown += 1
        const start = rangeOf(spans.map((span) => (span as Span).start))
        tasks.set(key, {
          ...estimate,
          phase: start.mid < asOf ? 'running' : 'waiting',
          start,
          end: rangeOf(spans.map((span) => (span as Span).end)),
        })
      }
    }
  }
  const all = [...ends.values()]
  return {
    basis: 'estimated',
    asOf,
    tasks,
    finish: all.length === 0 ? null : rangeOf(SCENARIOS.map((_, index) => max(...all.map((trio) => trio[index] as number)))),
    unknown,
    pace,
    unstarted,
    floor: unstarted.length > 0 || unknown > 0,
    runs: history.runs,
  }
}

/**
 * How far round its circle a task's outline goes: the share of its expected duration that has
 * passed since its inferred start, never the whole circle, which only the run reporting it ended earns.
 *
 * @param estimate - The task's estimate, or null
 * @param now - The current time
 * @returns From zero to {@link RING_CAP}, or null for a task that is not running or has no expected duration
 */
export function ringFraction(estimate: TaskEstimate | null, now: number): number | null {
  if (estimate === null || estimate.phase !== 'running' || estimate.start === null || estimate.expected === null) return null
  return min(RING_CAP, max(0, (now - estimate.start.mid) / max(1, estimate.expected.mid)))
}

/** How far a run is along, with what is left of it. */
export interface RunProgress {
  /** The share of the expected whole that has passed, from zero to one */
  fraction: number
  /** How long the run has been going */
  elapsedMs: number
  /** How long is left, or null once the run is past its high estimate */
  remaining: Range | null
}

/**
 * How far along an estimated run is at a moment.
 *
 * @param estimate - The run's estimate
 * @param start - When the run started, or null
 * @param now - The current time
 * @returns The progress, or null without a start or a finish
 */
export function progressAt(estimate: RunEstimate, start: number | null, now: number): RunProgress | null {
  if (start === null || estimate.finish === null) return null
  const { low, mid, high } = estimate.finish
  const elapsedMs = max(0, now - start)
  if (estimate.basis === 'final') return { fraction: 1, elapsedMs: max(0, mid - start), remaining: null }
  return {
    fraction: min(1, elapsedMs / max(1, max(mid, now) - start)),
    elapsedMs,
    remaining: now >= high ? null : { low: max(0, low - now), mid: max(0, mid - now), high: high - now },
  }
}
