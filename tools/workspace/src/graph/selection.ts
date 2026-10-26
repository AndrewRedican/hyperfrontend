/**
 * The records the affected analysis produces: the files that changed between two revisions, the
 * tasks selected and skipped, and the reason each decision rests on, drawn from a closed set of
 * rules so an explanation can always name the rule that fired.
 *
 * @module graph/selection
 */

import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/** What happened to one file between two revisions. */
export const ChangeStatus = freeze({
  Added: 'added',
  Modified: 'modified',
  Deleted: 'deleted',
  Renamed: 'renamed',
} as const)

/** One of the change statuses. */
export type ChangeStatus = (typeof ChangeStatus)[keyof typeof ChangeStatus]

/** One changed file. */
export interface FileChange {
  /** What happened to it. */
  readonly status: ChangeStatus
  /** The path at the head revision, or the deleted path. */
  readonly path: string
  /** The path at the base revision for a rename, else null. */
  readonly previousPath: string | null
}

/** The files that changed between two revisions. */
export interface ChangeSet {
  /** The base revision. */
  readonly base: string
  /** The head revision; the working tree when null. */
  readonly head: string | null
  /** The changes, sorted by path. */
  readonly changes: readonly FileChange[]
}

/** The closed set of rules an affected decision can rest on. */
export const ReasonRule = freeze({
  ChangedInput: 'changed-input',
  ReachableFromEntry: 'reachable-from-entry',
  Unreachable: 'unreachable',
  RoleIrrelevant: 'role-irrelevant',
  KindIrrelevant: 'kind-irrelevant',
  UnresolvedImport: 'unresolved-import',
  ExternalReExport: 'external-re-export',
  SideEffectImport: 'side-effect-import',
  Cycle: 'cycle',
  DependencyManifest: 'dependency-manifest',
  ProjectConfiguration: 'project-configuration',
  GlobalConfig: 'global-config',
  DeletedModule: 'deleted-module',
  RenamedModule: 'renamed-module',
  ToolChanged: 'tool-changed',
  DeclaredDependency: 'declared-dependency',
  ParseFailure: 'parse-failure',
  StateInvalidated: 'state-invalidated',
} as const)

/** One of the reason rules. */
export type ReasonRule = (typeof ReasonRule)[keyof typeof ReasonRule]

/** Why a task was selected or skipped. */
export interface Reason {
  /** The rule that fired. */
  readonly rule: ReasonRule
  /** The changed file the reason starts from, or null for a reason no file started. */
  readonly file: string | null
  /** The edges followed from the file to the task's project, as `source → target` ids. */
  readonly path: readonly string[]
  /** One sentence for a reader. */
  readonly message: string
}

/** One task's decision with its reasons. */
export interface TaskDecision {
  /** The task's id, `<project>:<target>`. */
  readonly task: string
  /** The reasons, in the order the rules fired. */
  readonly reasons: readonly Reason[]
}

/** The tasks of one target an analysis selected and skipped. */
export interface AffectedSet {
  /** The target analysed. */
  readonly target: string
  /** The change set analysed. */
  readonly changes: ChangeSet
  /** The tasks selected, sorted by id. */
  readonly selected: readonly TaskDecision[]
  /** The tasks skipped, sorted by id, each with the reason it was safe to skip. */
  readonly skipped: readonly TaskDecision[]
}
