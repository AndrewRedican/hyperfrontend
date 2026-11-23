/**
 * The pipeline model: a plan of chains (one project on one environment, its tasks and the
 * prerequisites between them) that the owned selection produces, the reasons a task is in it
 * beyond the selection's own rules, and the results a run of one environment records.
 *
 * @module pipeline/model
 */

import type { ReasonRule } from '@hyperfrontend/workspace/graph'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/** Where a chain runs. */
export const Environment = freeze({
  Linux: 'linux',
  Windows: 'windows',
  MacOS: 'macos',
} as const)

/** One of the environments. */
export type Environment = (typeof Environment)[keyof typeof Environment]

/**
 * The environment a platform is.
 *
 * @param platform - A platform as Node.js names it, such as `win32` or `darwin`
 * @returns Windows on win32, macOS on darwin, Linux otherwise
 */
export function environmentOf(platform: string): Environment {
  if (platform === 'win32') return Environment.Windows
  return platform === 'darwin' ? Environment.MacOS : Environment.Linux
}

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
  /** A file that defines the environment jobs changed, so every leg starts and runs its own steps. */
  EnvironmentJobs: 'environment-jobs',
  /** The task moved into the chain of the library it tests. */
  Folded: 'folded',
  /** A task the pipeline adds: a probe or a smoke after a build, or a task another planned task needs first. */
  PipelineTask: 'pipeline-task',
  /** A prerequisite did not succeed. */
  PrerequisiteFailed: 'prerequisite-failed',
  /** An earlier stage of a local run did not succeed, so the run ended before the task's stage. */
  StageFailed: 'stage-failed',
  /** A sibling environment, Windows or macOS, did not succeed before the publishes. */
  SiblingEnvironment: 'sibling-environment',
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

/** What the tasks of a plan or a run stood on. */
export interface Tested {
  /** The id of the tree the tasks ran on: the working tree as a git tree, untracked files included. */
  readonly tree: string
  /** The head commit of the pull request, or null when the run is not a pull request's. */
  readonly head: string | null
  /** The commit of the base branch the head was merged into, or null when the run is not a pull request's. */
  readonly base: string | null
  /** GitHub's merge of the head into the base, or null when the run is not a pull request's. */
  readonly merge: string | null
}

/** The workflow run that wrote a results file. */
export interface RunIdentity {
  /** The run id. */
  readonly id: number
  /** Which attempt of the run. */
  readonly attempt: number
  /** The head commit the run was for. */
  readonly sha: string
  /** The run's page, or null when the environment does not say. */
  readonly url: string | null
}

/** Where and when an inherited task really ran. */
export interface Origin {
  /** The id of the workflow run, or null for a run on this machine. */
  readonly run: number | null
  /** Which attempt of that run, or null for a run on this machine. */
  readonly attempt: number | null
  /** The head commit of that run, or null for a run on this machine. */
  readonly sha: string | null
  /** That run's page, or null when there is none. */
  readonly url: string | null
  /** The id of the tree the task ran on. */
  readonly tree: string
  /** The Node.js release the task ran on, as `process.version` names it. */
  readonly node: string
  /** When the task ended, epoch milliseconds. */
  readonly endedAt: number
}

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
  /** Where the task really ran, when it keeps the outcome of an earlier run in place of running. */
  readonly inherited?: Origin
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
  /** What the plan was made on; absent from a plan written before plans recorded it. */
  readonly tested?: Tested
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
  /** What a failed task printed that explains the failure, when it printed anything. */
  readonly excerpt?: string
  /** Where the task really ran, when the outcome is an earlier run's and the task did not run here. */
  readonly inherited?: Origin
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
  /** What the tasks ran on; absent from a file written before runs recorded it, which then offers no proof. */
  readonly tested?: Tested
  /** The workflow run that wrote the file, or null for a run on this machine. */
  readonly run?: RunIdentity | null
  /** The Node.js release the tasks ran on, as `process.version` names it. */
  readonly node?: string
  /** True when the run planned the working tree itself and ran it at once, as the hook does: only then is the tested tree surely the tree the tasks ran on outside a workflow. */
  readonly local?: boolean
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
