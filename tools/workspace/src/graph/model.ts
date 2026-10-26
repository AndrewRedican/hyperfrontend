/**
 * The owned graph model: the project records read off the workspace, the nodes a workspace holds
 * (projects, files, entries, externals, tools, configurations, tasks), the qualified edge record
 * their imports and declarations draw, and the project-level edges Nx draws.
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

/** A project's `package.json`, as far as the graph reads it. */
export interface PackageManifest {
  /** The package name. */
  readonly name?: string
  /** The version. */
  readonly version?: string
  /** Whether the package is private. */
  readonly private?: boolean
  /** The keywords, which become tags. */
  readonly keywords?: readonly string[]
  /** The runtime dependencies. */
  readonly dependencies?: Readonly<Record<string, string>>
  /** The development dependencies. */
  readonly devDependencies?: Readonly<Record<string, string>>
  /** The peer dependencies. */
  readonly peerDependencies?: Readonly<Record<string, string>>
  /** The optional dependencies. */
  readonly optionalDependencies?: Readonly<Record<string, string>>
  /** The exports map. */
  readonly exports?: unknown
  /** The executors manifest, relative to the package, for a package that implements executors. */
  readonly executors?: string
  /** Nx settings carried by the manifest. */
  readonly nx?: Readonly<Record<string, unknown>>
}

/** A target of a project, as far as the graph reads it. */
export interface TargetRecord {
  /** The executor, `<package>:<name>`. */
  readonly executor?: string
  /** The inputs, as `project.json` writes them. */
  readonly inputs?: readonly unknown[]
}

/** A project's `project.json`, as far as the graph reads it. */
export interface ProjectConfiguration {
  /** The project's name. */
  readonly name?: string
  /** `application` or `library`. */
  readonly projectType?: string
  /** The tags. */
  readonly tags?: readonly string[]
  /** The projects this one depends on without importing them. */
  readonly implicitDependencies?: readonly string[]
  /** The targets by name. */
  readonly targets?: Readonly<Record<string, TargetRecord>>
  /** The metadata. */
  readonly metadata?: Readonly<Record<string, unknown>>
  /** The source root. */
  readonly sourceRoot?: string
  /** The named inputs the project defines for its targets. */
  readonly namedInputs?: Readonly<Record<string, readonly unknown[]>>
}

/** One project: the data behind a `ProjectNode`. */
export interface ProjectRecord {
  /** The name Nx knows it by. */
  readonly name: string
  /** The root, workspace-relative and POSIX; `.` for the workspace itself. */
  readonly root: string
  /** `app` or `lib`. */
  readonly type: 'app' | 'lib'
  /** The tags: the manifest's visibility and keywords, then the configuration's. */
  readonly tags: readonly string[]
  /** The projects it depends on by declaration. */
  readonly implicitDependencies: readonly string[]
  /** The files it owns, workspace-relative and POSIX, in listing order. */
  readonly files: readonly string[]
  /** The manifest, or null when the project has none. */
  readonly manifest: PackageManifest | null
  /** The configuration, or null when the project has none. */
  readonly configuration: ProjectConfiguration | null
}

/** The forms an import takes, by what the statement brings in; `unresolved` for a load whose specifier is not a literal. */
export const ImportKind = freeze({
  Value: 'value',
  Type: 'type',
  SideEffect: 'side-effect',
  ReExportAll: 're-export-all',
  Dynamic: 'dynamic',
  Unresolved: 'unresolved',
} as const)

/** One of the import forms. */
export type ImportKind = (typeof ImportKind)[keyof typeof ImportKind]

/** One import of a file. */
export interface FileImport {
  /** The specifier as written, or the expression's text for an `unresolved` load. */
  readonly specifier: string
  /** Whether Nx counts it as dynamic: an `import()`, a `require` under braces, an import type opening a type alias. */
  readonly dynamic: boolean
  /** The form of the statement. */
  readonly kind: ImportKind
  /** Whether the statement brings in types alone, so erasing it leaves the runtime unchanged. */
  readonly typeOnly: boolean
  /** The names imported or re-exported: `default`, `*` for a namespace, the exported names; empty when unknown or none. */
  readonly names: readonly string[]
  /** The one-based line of the statement. */
  readonly line: number
  /** The one-based column of the statement. */
  readonly column: number
}

/** A specifier naming a workspace project. */
export interface ProjectResolution {
  /** The resolution's kind. */
  readonly kind: 'project'
  /** The project the specifier names. */
  readonly project: ProjectRecord
  /** The file within it, or null when the specifier names a package without a matching entry or a missing file. */
  readonly file: string | null
  /** The workspace-relative path the specifier named, or null for a package name. */
  readonly path: string | null
}

/** A specifier naming an npm package. */
export interface NpmResolution {
  /** The resolution's kind. */
  readonly kind: 'npm'
  /** The package name, scope included. */
  readonly name: string
}

/** A specifier naming a Node built-in. */
export interface BuiltinResolution {
  /** The resolution's kind. */
  readonly kind: 'builtin'
}

/** A specifier naming a path no project holds. */
export interface UnknownResolution {
  /** The resolution's kind. */
  readonly kind: 'unknown'
  /** The workspace-relative path the specifier named. */
  readonly path: string
}

/** What a specifier names. */
export type Resolution = ProjectResolution | NpmResolution | BuiltinResolution | UnknownResolution

/** An edge between projects, as Nx draws it. */
export interface ProjectEdge {
  /** The depending project. */
  readonly source: string
  /** The project depended on. */
  readonly target: string
  /** `static` for an import, `dynamic` for a dynamic import, `implicit` for a declaration. */
  readonly type: 'static' | 'dynamic' | 'implicit'
  /** The files of the source that draw the edge, for an import. */
  readonly files: readonly string[]
}

/** The npm packages a project's files import. */
export interface NpmUse {
  /** The package name. */
  readonly name: string
  /** The files importing it. */
  readonly files: readonly string[]
}

/** The edges between two projects of one kind and one role, grouped. */
export interface EdgeGroup {
  /** The depending project. */
  readonly source: string
  /** The project depended on. */
  readonly target: string
  /** What produced the edges. */
  readonly kind: EdgeKind
  /** The role of the files that drew them. */
  readonly role: Role
  /** The files of the source that draw the edges, in listing order. */
  readonly files: readonly string[]
}

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
