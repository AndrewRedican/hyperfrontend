import type { Chain, Environment, Outcome, PlanTask, RunRecord, RunResults, SkippedTask, TaskResult } from './model'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { max, min, round, trunc } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** One task of a chain as the timeline draws it. */
export interface TimelineTask {
  /** The planned task */
  task: PlanTask
  /** What it ended as, or null when the record has no result for it */
  result: TaskResult | null
}

/** One chain as the timeline draws it. */
export interface TimelineChain {
  /** The chain */
  chain: Chain
  /** Its tasks, in chain order */
  tasks: TimelineTask[]
}

/** An environment's run laid out on one clock. */
export interface Timeline {
  /** The environment */
  environment: Environment
  /** The chains, in scheduling order */
  chains: TimelineChain[]
  /** When the run started */
  start: number
  /** When the last task ended */
  end: number
  /** The results the record holds for the environment, or null */
  results: RunResults | null
}

/** How many tasks ended each way. */
export interface OutcomeCounts {
  /** Succeeded */
  success: number
  /** Failed */
  failure: number
  /** Skipped behind a failure */
  skipped: number
  /** Cancelled */
  cancelled: number
  /** Never reached an outcome in the record */
  pending: number
}

/**
 * The timeline of one environment of a record.
 *
 * @param record - The run record
 * @param environment - Linux, Windows or macOS
 * @returns The timeline; chains without a result still appear, their tasks pending
 */
export function timelineOf(record: RunRecord, environment: Environment): Timeline {
  const results = record.results[environment] ?? null
  const byId = createMap((results?.tasks ?? []).map((result) => [result.id, result] as const))
  const chains = record.plan.chains
    .filter((chain) => chain.environment === environment)
    .sort((left, right) => left.order - right.order)
    .map((chain) => ({ chain, tasks: chain.tasks.map((task) => ({ task, result: byId.get(task.id) ?? null })) }))
  let start = results?.startedAt ?? 0
  let end = results?.endedAt ?? 0
  for (const result of results?.tasks ?? []) {
    if (result.startedAt !== null) start = start === 0 ? result.startedAt : min(start, result.startedAt)
    if (result.endedAt !== null) end = max(end, result.endedAt)
  }
  return { environment, chains, start, end: max(end, start), results }
}

/**
 * How the tasks of a timeline ended.
 *
 * @param timeline - The environment's run
 * @returns How many tasks ended each way
 */
export function outcomeCounts(timeline: Timeline): OutcomeCounts {
  const counts: OutcomeCounts = { success: 0, failure: 0, skipped: 0, cancelled: 0, pending: 0 }
  for (const chain of timeline.chains) {
    for (const { result } of chain.tasks) {
      if (result === null) counts.pending += 1
      else counts[result.outcome] += 1
    }
  }
  return counts
}

/**
 * A duration as a reader sees it.
 *
 * @param ms - Milliseconds
 * @returns `18m 17s`, `47s` or `0.8s`
 */
export function formatDuration(ms: number): string {
  const seconds = ms / 1000
  if (seconds < 10) return `${round(seconds * 10) / 10}s`
  if (seconds < 60) return `${round(seconds)}s`
  const minutes = trunc(seconds / 60)
  return `${minutes}m ${round(seconds - minutes * 60)}s`
}

/** The glyph and the word of an outcome. */
export interface OutcomeMark {
  /** One character */
  glyph: string
  /** One word */
  label: string
}

/** The skipped tasks that share a rule. */
export interface RuleGroup {
  /** The rule */
  rule: string
  /** The task ids */
  tasks: string[]
}

/**
 * The mark and the word of an outcome.
 *
 * @param outcome - The outcome, or null for a task without one
 * @returns The glyph and the label
 */
export function outcomeMark(outcome: Outcome | null): OutcomeMark {
  switch (outcome) {
    case 'success':
      return { glyph: '✓', label: 'succeeded' }
    case 'failure':
      return { glyph: '✕', label: 'failed' }
    case 'skipped':
      return { glyph: '→', label: 'skipped' }
    case 'cancelled':
      return { glyph: '⊘', label: 'cancelled' }
    default:
      return { glyph: '·', label: 'no result' }
  }
}

/**
 * The skipped tasks of a plan grouped by the rule that made each skip safe.
 *
 * @param skipped - The plan's skipped tasks
 * @returns The task ids by rule, rules with the most tasks first
 */
export function skippedByRule(skipped: readonly SkippedTask[]): RuleGroup[] {
  const groups = createMap<string, string[]>()
  for (const entry of skipped) {
    const rule = entry.reasons[0]?.rule ?? 'unknown'
    groups.set(rule, [...(groups.get(rule) ?? []), entry.task])
  }
  return [...groups].map(([rule, tasks]) => ({ rule, tasks })).sort((left, right) => right.tasks.length - left.tasks.length)
}

/**
 * A short form of a commit.
 *
 * @param sha - The commit
 * @returns Its first twelve characters
 */
export function shortSha(sha: string): string {
  return sha.slice(0, 12)
}

/**
 * A time as a reader sees it, in their own zone.
 *
 * @param epochMs - Epoch milliseconds
 * @returns The date and the time
 */
export function formatWhen(epochMs: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(epochMs)
}
