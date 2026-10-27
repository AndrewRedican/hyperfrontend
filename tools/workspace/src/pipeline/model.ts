/**
 * The pipeline model: a plan of chains (one project on one environment, its tasks and the
 * prerequisites between them) that the owned selection produces, the reasons a task is in it
 * beyond the selection's own rules, and the results a run of one environment records.
 *
 * @module pipeline/model
 */

import type { ReasonRule } from '../graph/selection'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/** Where a chain runs. */
export const Environment = freeze({
  Linux: 'linux',
  Windows: 'windows',
} as const)

/** One of the environments. */
export type Environment = (typeof Environment)[keyof typeof Environment]

/** How much of a runner a task occupies. */
export const Weight = freeze({
  /** One of the light slots: typecheck, lint, test, e2e, probes, publishes. */
  Light: 'light',
  /** One of the heavy slots: a library build, which is RAM-bound. */
  Heavy: 'heavy',
} as const)

/** One of the weights. */
export type Weight = (typeof Weight)[keyof typeof Weight]

/** The rules the pipeline adds to the selection's closed set. */
export const PipelineRule = freeze({
  /** The plan runs every task of every project. */
  FullPlan: 'full-plan',
  /** The registry lacks the library's current version. */
  RegistryDrift: 'registry-drift',
  /** The task moved into the chain of the library it tests. */
  Folded: 'folded',
  /** A task the pipeline adds: a probe or a smoke after a build, or a task another planned task needs first. */
  PipelineTask: 'pipeline-task',
  /** A prerequisite did not succeed. */
  PrerequisiteFailed: 'prerequisite-failed',
  /** The Windows environment did not succeed before the publishes. */
  WindowsEnvironment: 'windows-environment',
  /** The run was interrupted before the task started. */
  Cancelled: 'cancelled',
} as const)

/** One of the pipeline rules. */
export type PipelineRule = (typeof PipelineRule)[keyof typeof PipelineRule]

/** A rule a plan reason can rest on: the selection's or the pipeline's. */
export type PlanRule = ReasonRule | PipelineRule

/** Why a task is in the plan; a selection reason is one of these. */
export interface PlanReason {
  /** The rule that fired. */
  readonly rule: PlanRule
  /** The changed file the reason starts from, or null for a reason no file started. */
  readonly file: string | null
  /** The edges followed, or the tasks named, as ids. */
  readonly path: readonly string[]
  /** One sentence for a reader. */
  readonly message: string
}

/** What a run of a task ended as. */
export const Outcome = freeze({
  Success: 'success',
  Failure: 'failure',
  Skipped: 'skipped',
  Cancelled: 'cancelled',
} as const)

/** One of the outcomes. */
export type Outcome = (typeof Outcome)[keyof typeof Outcome]

/** A task of a requested target the plan leaves out. */
export interface SkippedTask {
  /** The task id. */
  readonly task: string
  /** Why it was safe to leave out. */
  readonly reasons: readonly PlanReason[]
}

/** One task of a plan. */
export interface PlanTask {
  /** `<project>:<target>`: a target of the project, or one of the pipeline's own targets. */
  readonly id: string
  /** The chain's project, which is the library for a folded e2e task. */
  readonly project: string
  /** The target. */
  readonly target: string
  /** Where the task runs. */
  readonly environment: Environment
  /** The tasks of the same environment that must succeed first. */
  readonly needs: readonly string[]
  /** The slot the task occupies. */
  readonly weight: Weight
  /** Why the task is in the plan. */
  readonly reasons: readonly PlanReason[]
  /** The command, as an argument vector run from the workspace root. */
  readonly command: readonly string[]
  /** Environment entries set on top of the process environment. */
  readonly env: Readonly<Record<string, string>>
}

/** One project on one environment. */
export interface Chain {
  /** The project. */
  readonly project: string
  /** Where the chain runs. */
  readonly environment: Environment
  /** The rank the scheduler serves the chain's ready tasks in; lower first. */
  readonly order: number
  /** The tasks, prerequisites first. */
  readonly tasks: readonly PlanTask[]
}

/** How a plan was selected. */
export type PlanMode = 'affected' | 'all'

/** A plan. */
export interface Plan {
  /** The base revision, or `all` when every task runs. */
  readonly base: string
  /** The head revision, or null for the working tree. */
  readonly head: string | null
  /** Whether the plan was selected or runs everything. */
  readonly mode: PlanMode
  /** Whether the plan publishes. */
  readonly main: boolean
  /** The targets the plan selected. */
  readonly targets: readonly string[]
  /** The libraries the registry drift added. */
  readonly drift: readonly string[]
  /** The chains, in scheduling order. */
  readonly chains: readonly Chain[]
  /** The tasks of the requested targets the selection skipped, with the reason each was safe to skip. */
  readonly skipped: readonly SkippedTask[]
  /** The environments with at least one chain. */
  readonly environments: readonly Environment[]
}

/** What one task's run ended as. */
export interface TaskResult {
  /** The task id. */
  readonly id: string
  /** The chain's project. */
  readonly project: string
  /** The target. */
  readonly target: string
  /** Where the task ran. */
  readonly environment: Environment
  /** Why the task was in the plan. */
  readonly reasons: readonly PlanReason[]
  /** What happened. */
  readonly outcome: Outcome
  /** The exit code, or null when the task did not run to an exit. */
  readonly exitCode: number | null
  /** Why the task was skipped or cancelled, or what kept it from running to an exit, or null. */
  readonly detail: string | null
  /** When the task started, epoch milliseconds, or null when it did not start. */
  readonly startedAt: number | null
  /** When the task ended, epoch milliseconds, or null when it did not start. */
  readonly endedAt: number | null
  /** How long the task ran. */
  readonly durationMs: number
  /** The log file, workspace-relative, or null when the task did not run. */
  readonly log: string | null
}

/** The results of one environment's run. */
export interface RunResults {
  /** The environment that ran. */
  readonly environment: Environment
  /** The plan's base. */
  readonly base: string
  /** The plan's head. */
  readonly head: string | null
  /** The plan's mode. */
  readonly mode: PlanMode
  /** When the run started, epoch milliseconds. */
  readonly startedAt: number
  /** When the run ended, epoch milliseconds. */
  readonly endedAt: number
  /** The wall-clock of the run so far. */
  readonly durationMs: number
  /** Whether the run ended; false while the file is rewritten after each task that ends. */
  readonly complete: boolean
  /** Every task of the environment, in chain order; while the run is incomplete, the tasks that ended. */
  readonly tasks: readonly TaskResult[]
}

/**
 * A plan reason.
 *
 * @param rule - The rule that fired
 * @param message - One sentence for a reader
 * @param path - The tasks or edges named, as ids
 * @returns The reason, with no file
 */
export function planReason(rule: PlanRule, message: string, path: readonly string[] = []): PlanReason {
  return { rule, file: null, path, message }
}

/** The two parts of a task id. */
export interface TaskName {
  /** The project. */
  readonly project: string
  /** The target. */
  readonly target: string
}

/**
 * The project and target of a task id.
 *
 * @param id - `<project>:<target>`
 * @returns The two parts, split at the first colon
 */
export function splitTaskId(id: string): TaskName {
  const colon = id.indexOf(':')
  return { project: id.slice(0, colon), target: id.slice(colon + 1) }
}
