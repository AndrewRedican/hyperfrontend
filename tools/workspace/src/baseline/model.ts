/**
 * What Nx selects for a revision range, captured as evidence: the affected projects and, per
 * task, the reasons its task-level selection gives. The owned analysis is compared against it.
 *
 * @module baseline/model
 */

/** One reason Nx gives for selecting a task, as `nx affected --explain` writes it. */
export interface NxReason {
  /** The reason's kind: `input-file`, `npm-package`, `dependent-output` and the others Nx names. */
  readonly kind: string
  /** The changed file the reason points at, when it has one. */
  readonly file?: string
  /** The input pattern the file matched, for `input-file`. */
  readonly pattern?: string
  /** The task whose output carried the change, for `dependent-output`. */
  readonly producer?: string
  /** The moved package, for `npm-package`. */
  readonly package?: string
}

/** How many tasks of the requested targets Nx chose among. */
export interface NxRequested {
  /** The targets asked for. */
  readonly targets: readonly string[]
  /** The tasks of those targets in the task graph. */
  readonly total: number
}

/** The JSON `nx affected --explain` writes. */
export interface NxExplanation {
  /** The tasks of the requested targets Nx would run, each with its reasons. */
  readonly affected: Readonly<Record<string, readonly NxReason[]>>
  /** The tasks the affected ones depend on that also saw a change. */
  readonly upstream: Readonly<Record<string, readonly NxReason[]>>
  /** The tasks a changed file touched directly. */
  readonly touched: readonly string[]
  /** What was asked for. */
  readonly requested: NxRequested
}

/** Nx's selection for one revision range. */
export interface BaselineSelection {
  /** The base revision. */
  readonly base: string
  /** The head revision. */
  readonly head: string
  /** The affected projects, sorted. */
  readonly projects: readonly string[]
  /** The task-level selection for the captured targets. */
  readonly explanation: NxExplanation
}

/** A merge replayed from history, with Nx's selection captured at its head. */
export interface ReplayedMerge {
  /** The merge commit. */
  readonly sha: string
  /** The merge base of its parents: where the merged branch forked. */
  readonly base: string
  /** The merged branch's tip: the second parent. */
  readonly head: string
  /** When the merge was committed, ISO 8601. */
  readonly committedAt: string
  /** Whether the lock file at the head differs from the one the shared `node_modules` was installed from. */
  readonly lockfileSkew: boolean
  /** Nx's selection at the head. */
  readonly selection: BaselineSelection
}
