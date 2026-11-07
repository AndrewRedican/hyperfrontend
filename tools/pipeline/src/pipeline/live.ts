/**
 * The state a run publishes while it runs, carried by its check runs: a compact plan in the
 * `pipeline plan` check run, and each chain's ended tasks in the chain's own check run, both
 * as JSON a page can read through the GitHub API without a token.
 *
 * @module pipeline/live
 */

import type { CheckOutput } from './checks'
import type { Chain, Environment, Plan, PlanMode, TaskResult, Weight } from './model'
import { createTextEncoder } from '@hyperfrontend/immutable-api-utils/built-in-copy/encoding'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createUint8Array } from '@hyperfrontend/immutable-api-utils/built-in-copy/typed-arrays'
import { planSummary } from './report'

/** The schema of the state the check runs carry. */
export const LIVE_SCHEMA = 1

/** The most UTF-8 bytes a check run's summary or text may hold. */
export const CHECK_TEXT_LIMIT = 65535

/** The name of the check run carrying the plan. */
export const PLAN_CHECK_NAME = 'pipeline plan'

/** A task of the compact plan. */
export interface CompactTask {
  /** The task id. */
  readonly id: string
  /** The target. */
  readonly target: string
  /** The slot it occupies. */
  readonly weight: Weight
  /** The tasks that must succeed first; empty when the plan was truncated. */
  readonly needs: readonly string[]
}

/** A chain of the compact plan. */
export interface CompactChain {
  /** The project. */
  readonly project: string
  /** Where it runs. */
  readonly environment: Environment
  /** Its scheduling rank. */
  readonly order: number
  /** Its tasks, prerequisites first. */
  readonly tasks: readonly CompactTask[]
}

/** The plan without its reasons: what a page needs to draw the run. */
export interface CompactPlan {
  /** The schema. */
  readonly schema: typeof LIVE_SCHEMA
  /** The base revision, or `all`. */
  readonly base: string
  /** The head revision, or null for the working tree. */
  readonly head: string | null
  /** Whether the plan was selected or runs everything. */
  readonly mode: PlanMode
  /** Whether the plan publishes. */
  readonly main: boolean
  /** The environments with chains. */
  readonly environments: readonly Environment[]
  /** The chains, in scheduling order. */
  readonly chains: readonly CompactChain[]
  /** How many tasks the plan skipped with a reason. */
  readonly skipped: number
  /** Whether the needs were dropped to fit the text limit. */
  readonly truncated: boolean
}

/** One ended task as the chain's check run carries it. */
export interface ChainTaskState {
  /** The task id. */
  readonly id: string
  /** What happened. */
  readonly outcome: TaskResult['outcome']
  /** The exit code, or null. */
  readonly exitCode: number | null
  /** Why it was skipped or cancelled, or null. */
  readonly detail: string | null
  /** When it started, or null. */
  readonly startedAt: number | null
  /** When it ended, or null. */
  readonly endedAt: number | null
}

/** A chain's state as its check run carries it. */
export interface ChainState {
  /** The schema. */
  readonly schema: typeof LIVE_SCHEMA
  /** The project. */
  readonly project: string
  /** Where the chain runs. */
  readonly environment: Environment
  /** How many tasks the chain has. */
  readonly total: number
  /** The tasks that ended, in chain order. */
  readonly tasks: readonly ChainTaskState[]
}

/**
 * Text cut to the check-run limit, with a line saying so when it was. GitHub counts the limit
 * in UTF-8 bytes, so the cut never splits a character and the note's own bytes are reserved.
 *
 * @param text - Any text
 * @param limit - The most UTF-8 bytes allowed
 * @returns The text, or its head and a note
 */
export function clip(text: string, limit: number = CHECK_TEXT_LIMIT): string {
  const encoder = createTextEncoder()
  if (encoder.encode(text).length <= limit) return text
  const note = '\n\n… truncated; the pipeline-plan artifact holds the whole plan.'
  const { read } = encoder.encodeInto(text, createUint8Array(limit - encoder.encode(note).length))
  return `${text.slice(0, read)}${note}`
}

/**
 * The plan without its reasons.
 *
 * @param plan - The plan published
 * @param limit - The most characters its JSON may take
 * @returns The compact plan; the needs are dropped when the JSON would not fit
 */
export function compactPlan(plan: Plan, limit: number = CHECK_TEXT_LIMIT): CompactPlan {
  const shape = (withNeeds: boolean): CompactPlan => ({
    schema: LIVE_SCHEMA,
    base: plan.base,
    head: plan.head,
    mode: plan.mode,
    main: plan.main,
    environments: plan.environments,
    chains: plan.chains.map((chain: Chain) => ({
      project: chain.project,
      environment: chain.environment,
      order: chain.order,
      tasks: chain.tasks.map((task) => ({ id: task.id, target: task.target, weight: task.weight, needs: withNeeds ? task.needs : [] })),
    })),
    skipped: plan.skipped.length,
    truncated: !withNeeds,
  })
  const full = shape(true)
  return stringify(full).length <= limit ? full : shape(false)
}

/**
 * What the `pipeline plan` check run shows: the plan summary and the compact plan.
 *
 * @param plan - The plan published
 * @returns The title, the summary and the text
 */
export function planCheckOutput(plan: Plan): CheckOutput {
  const tasks = plan.chains.reduce((count, chain) => count + chain.tasks.length, 0)
  return {
    title: `${plan.chains.length} chains, ${tasks} tasks`,
    summary: clip(planSummary(plan).join('\n')),
    text: stringify(compactPlan(plan)),
  }
}

/**
 * A chain's state as JSON.
 *
 * @param chain - The chain whose tasks ended
 * @param results - The tasks of the chain that ended
 * @returns The JSON text
 */
export function chainState(chain: Chain, results: readonly TaskResult[]): string {
  const state: ChainState = {
    schema: LIVE_SCHEMA,
    project: chain.project,
    environment: chain.environment,
    total: chain.tasks.length,
    tasks: results.map(({ id, outcome, exitCode, detail, startedAt, endedAt }) => ({ id, outcome, exitCode, detail, startedAt, endedAt })),
  }
  return stringify(state)
}
