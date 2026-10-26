/**
 * The owned graph model: the nodes a workspace holds (projects, files, entries, externals, tools,
 * configurations, tasks), the qualified edge record their imports and declarations draw, and the
 * change, selection and reason records the affected analysis produces.
 *
 * @module graph/model
 */

import type { Role } from './roles'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/** The kinds of node. */
export const NodeKind = freeze({
  Project: 'project',
  File: 'file',
  Entry: 'entry',
  External: 'external',
  Tool: 'tool',
  Config: 'config',
  Task: 'task',
} as const)

/** One of the node kinds. */
export type NodeKind = (typeof NodeKind)[keyof typeof NodeKind]

/** A project, named as Nx names it. */
export interface ProjectNode {
  /** The node's kind. */
  readonly kind: 'project'
  /** The project's name. */
  readonly name: string
  /** The root, workspace-relative and POSIX; `.` for the workspace itself. */
  readonly root: string
}

/** A file the workspace tracks. */
export interface FileNode {
  /** The node's kind. */
  readonly kind: 'file'
  /** The path, workspace-relative and POSIX. */
  readonly path: string
  /** The owning project, or null when no project root contains the file. */
  readonly project: string | null
  /** The role the file plays in its project. */
  readonly role: Role
}

/** An entry point a project exposes: a package name or a package subpath. */
export interface EntryNode {
  /** The node's kind. */
  readonly kind: 'entry'
  /** `<package>` or `<package>/<subpath>`, as consumers import it. */
  readonly id: string
  /** The project that owns the entry. */
  readonly project: string
  /** The file the entry resolves to, workspace-relative and POSIX. */
  readonly file: string
}

/** An installed npm package. */
export interface ExternalNode {
  /** The node's kind. */
  readonly kind: 'external'
  /** The package name, scope included. */
  readonly name: string
  /** The installed version, or null when the lock file records none. */
  readonly version: string | null
}

/** An executor or command a target runs, resolved to the project implementing it. */
export interface ToolNode {
  /** The node's kind. */
  readonly kind: 'tool'
  /** The executor or command as the target names it, for example `@hyperfrontend/package:build`. */
  readonly id: string
  /** The workspace project implementing it, or null for an installed tool. */
  readonly project: string | null
  /** The entry of that project the tool loads, or null when none is known. */
  readonly entry: string | null
}

/** A configuration file a target reads. */
export interface ConfigNode {
  /** The node's kind. */
  readonly kind: 'config'
  /** The file, workspace-relative and POSIX. */
  readonly path: string
}

/** A task: one target of one project. */
export interface TaskRef {
  /** The node's kind. */
  readonly kind: 'task'
  /** The project. */
  readonly project: string
  /** The target. */
  readonly target: string
}

/** Any node of the graph. */
export type GraphNode = ProjectNode | FileNode | EntryNode | ExternalNode | ToolNode | ConfigNode | TaskRef

/** The kinds of edge, by what produces them. */
export const EdgeKind = freeze({
  Value: 'value',
  Type: 'type',
  SideEffect: 'side-effect',
  ReExportAll: 're-export-all',
  Dynamic: 'dynamic',
  Unresolved: 'unresolved',
  Manifest: 'manifest',
  Declared: 'declared',
  Tool: 'tool',
  Config: 'config',
} as const)

/** One of the edge kinds. */
export type EdgeKind = (typeof EdgeKind)[keyof typeof EdgeKind]

/** The specifier an edge was written with and what it resolved to. */
export interface EdgePath {
  /** The specifier as written in the source or configuration. */
  readonly specifier: string
  /** The resolved file, workspace-relative and POSIX, or the package name; null when unresolved. */
  readonly resolved: string | null
}

/** Where in a source file an edge was drawn. */
export interface SourceEvidence {
  /** The evidence's kind. */
  readonly kind: 'source'
  /** The file, workspace-relative and POSIX. */
  readonly file: string
  /** The one-based line. */
  readonly line: number
  /** The one-based column. */
  readonly column: number
}

/** Which configuration key declared an edge. */
export interface ConfigurationEvidence {
  /** The evidence's kind. */
  readonly kind: 'configuration'
  /** The configuration file, workspace-relative and POSIX. */
  readonly file: string
  /** The key within it, dotted, for example `targets.build.inputs`. */
  readonly key: string
}

/** What an edge rests on. */
export type EdgeEvidence = SourceEvidence | ConfigurationEvidence

/** One edge between two nodes. */
export interface Edge {
  /** The depending node's id, as `nodeId` writes it. */
  readonly source: string
  /** The depended-on node's id. */
  readonly target: string
  /** What produced the edge. */
  readonly kind: EdgeKind
  /** The role of the importing or declaring file. */
  readonly role: Role
  /** The specifier and its resolution, or null for an edge no specifier drew. */
  readonly path: EdgePath | null
  /** The targets the edge is relevant to; empty means every target. */
  readonly targets: readonly string[]
  /** Where the edge was drawn. */
  readonly evidence: EdgeEvidence
}

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

/**
 * The id of a node, unique across kinds.
 *
 * @param node - The node to identify
 * @returns `<kind>:<identity>`
 */
export function nodeId(node: GraphNode): string {
  switch (node.kind) {
    case 'project':
      return `project:${node.name}`
    case 'file':
      return `file:${node.path}`
    case 'entry':
      return `entry:${node.id}`
    case 'external':
      return `external:${node.name}@${node.version ?? '*'}`
    case 'tool':
      return `tool:${node.id}`
    case 'config':
      return `config:${node.path}`
    case 'task':
      return `task:${taskId(node)}`
  }
}

/**
 * The id of a task as Nx writes it.
 *
 * @param task - The task to identify
 * @returns `<project>:<target>`
 */
export function taskId(task: TaskRef): string {
  return `${task.project}:${task.target}`
}

/**
 * Orders two edges deterministically: by source, target, kind, role, specifier, then evidence.
 *
 * @param left - One edge
 * @param right - Another
 * @returns Negative, zero or positive as a comparator does
 */
export function compareEdges(left: Edge, right: Edge): number {
  return (
    compareText(left.source, right.source) ||
    compareText(left.target, right.target) ||
    compareText(left.kind, right.kind) ||
    compareText(left.role, right.role) ||
    compareText(left.path?.specifier ?? '', right.path?.specifier ?? '') ||
    compareText(left.evidence.file, right.evidence.file) ||
    compareEvidencePosition(left.evidence, right.evidence)
  )
}

/**
 * Orders two pieces of evidence from the same file: a source position by line and column, a
 * configuration key by text; source evidence sorts before configuration evidence.
 *
 * @param left - One piece of evidence
 * @param right - Another
 * @returns Negative, zero or positive as a comparator does
 */
function compareEvidencePosition(left: EdgeEvidence, right: EdgeEvidence): number {
  if (left.kind === 'source' && right.kind === 'source') return left.line - right.line || left.column - right.column
  if (left.kind === 'configuration' && right.kind === 'configuration') return compareText(left.key, right.key)
  return left.kind === 'source' ? -1 : 1
}

/**
 * Orders two strings by code unit, the way every serialisation of the graph is ordered.
 *
 * @param left - One string
 * @param right - Another
 * @returns Negative, zero or positive as a comparator does
 */
export function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

/**
 * The edges in their canonical order, so two graphs built from the same inputs serialise to the
 * same bytes whatever order their edges were found in.
 *
 * @param edges - The edges in any order
 * @returns A sorted copy
 */
export function sortEdges(edges: readonly Edge[]): Edge[] {
  return [...edges].sort(compareEdges)
}
