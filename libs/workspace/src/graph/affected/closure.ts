/**
 * Reachability over the file graph: from a set of files, every file a change of which can reach
 * them, following the edges of the kinds a target cares about, with the conservative collapses the
 * analysis promises: a project with a parse failure, a non-literal load or a dangling import in the
 * reachable set counts whole, as does a project in a cross-project cycle, a declared dependency, and
 * the target of a side-effect import anywhere in a project the closure enters.
 *
 * @module graph/affected/closure
 */

import type { WorkspaceGraph } from '../build'
import type { Edge, EdgeKind, ProjectEdge, ProjectRecord } from '../model'
import type { ReasonRule } from '../selection'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { createWeakMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/weak-map'
import { EdgeKind as Kinds } from '../model'
import { Role } from '../roles'
import { ReasonRule as Rules } from '../selection'

/** How a file or project entered the closure. */
export interface Hop {
  /** The file whose edge or collapse brought it in, or null for a seed. */
  readonly from: string | null
  /** The edge followed, or null for a seed or a collapse without one. */
  readonly edge: Edge | null
  /** The fallback rule that brought it in, or null for an ordinary edge. */
  readonly rule: ReasonRule | null
}

/** A fallback that fired while the closure was followed. */
export interface Fallback {
  /** The edge that could not be followed precisely. */
  readonly edge: Edge
  /** The rule that fired. */
  readonly rule: ReasonRule
  /** The project collapsed to project level. */
  readonly project: string
}

/** What a set of files reaches. */
export interface Closure {
  /** Every reachable file, with how it was reached first. */
  readonly files: ReadonlyMap<string, Hop>
  /** Every project collapsed to project level, with why. */
  readonly projects: ReadonlyMap<string, Hop>
  /** Every project any file of which is reachable. */
  readonly touched: ReadonlySet<string>
  /** The fallbacks that fired. */
  readonly fallbacks: readonly Fallback[]
}

/** The indexes a closure walks. */
interface GraphIndex {
  /** The edges drawn by each file. */
  readonly outgoing: ReadonlyMap<string, readonly Edge[]>
  /** The project owning each file node. */
  readonly fileProject: ReadonlyMap<string, string | null>
  /** The files of each project that count at project level: every role but spec, test and lint configuration. */
  readonly projectFiles: ReadonlyMap<string, readonly string[]>
  /** The side-effect edges drawn by each project's production-like files. */
  readonly sideEffects: ReadonlyMap<string, readonly Edge[]>
  /** The parse-failure edges drawn by each project's production-like files. */
  readonly parseFailures: ReadonlyMap<string, readonly Edge[]>
  /** The other members of each project's cross-project cycle, for projects in one. */
  readonly cycles: ReadonlyMap<string, readonly string[]>
}

/** Every edge kind. */
export const ALL_KINDS: ReadonlySet<EdgeKind> = createSet(values(Kinds))

/** The roles left out when a project counts whole. */
const EXCLUDED_ROLES: ReadonlySet<Role> = createSet<Role>([Role.Spec, Role.TestConfig, Role.LintConfig])

/** The indexes built so far, by graph. */
const indexes = createWeakMap<WorkspaceGraph, GraphIndex>()

/**
 * The strongly connected components of the project graph with more than one member, by member.
 *
 * @param graph - The graph whose project edges are walked
 * @returns Each member of a cross-project cycle to the other members
 */
function cycleMembers(graph: WorkspaceGraph): Map<string, readonly string[]> {
  const index = createMap<string, number>()
  const low = createMap<string, number>()
  const stack: string[] = []
  const onStack = createSet<string>()
  const members = createMap<string, readonly string[]>()
  let counter = 0
  const visit = (project: string): void => {
    index.set(project, counter)
    low.set(project, counter)
    counter += 1
    stack.push(project)
    onStack.add(project)
    for (const edge of graph.edges.get(project) as readonly ProjectEdge[]) {
      if (!graph.projects.has(edge.target)) continue
      if (!index.has(edge.target)) {
        visit(edge.target)
        low.set(project, min(low.get(project) as number, low.get(edge.target) as number))
      } else if (onStack.has(edge.target)) low.set(project, min(low.get(project) as number, index.get(edge.target) as number))
    }
    if (low.get(project) !== index.get(project)) return
    const component: string[] = []
    for (let top = stack.pop() as string; ; top = stack.pop() as string) {
      onStack.delete(top)
      component.push(top)
      if (top === project) break
    }
    if (component.length > 1)
      for (const member of component)
        members.set(
          member,
          component.filter((other) => other !== member)
        )
  }
  for (const project of graph.projects.keys()) if (!index.has(project)) visit(project)
  return members
}

/**
 * The indexes of a graph, built on first use.
 *
 * @param graph - The graph to index
 * @returns The indexes
 */
function indexOf(graph: WorkspaceGraph): GraphIndex {
  let index = indexes.get(graph)
  if (index !== undefined) return index
  const outgoing = createMap<string, Edge[]>()
  const fileProject = createMap<string, string | null>()
  const projectFiles = createMap<string, string[]>([...graph.projects.keys()].map((name) => [name, []]))
  const sideEffects = createMap<string, Edge[]>()
  const parseFailures = createMap<string, Edge[]>()
  const push = <Value>(map: Map<string, Value[]>, key: string, value: Value): void => {
    map.set(key, [...(map.get(key) ?? []), value])
  }
  for (const node of graph.nodes.values()) {
    if (node.kind !== 'file') continue
    fileProject.set(node.path, node.project)
    if (node.project !== null && !EXCLUDED_ROLES.has(node.role)) projectFiles.get(node.project)?.push(node.path)
  }
  for (const edge of graph.records) {
    if (!edge.source.startsWith('file:')) continue
    const path = edge.source.slice('file:'.length)
    push(outgoing, path, edge)
    // why: every file edge is drawn by a file node, and the workspace root is itself a project, so the source has an owner.
    const project = fileProject.get(path) as string
    if (EXCLUDED_ROLES.has(edge.role)) continue
    if (edge.kind === 'side-effect') push(sideEffects, project, edge)
    if (edge.kind === 'unresolved' && edge.path === null) push(parseFailures, project, edge)
  }
  index = { outgoing, fileProject, projectFiles, sideEffects, parseFailures, cycles: cycleMembers(graph) }
  indexes.set(graph, index)
  return index
}

/**
 * The project an unresolved edge collapses: the owner of the dangling path, the project a package
 * specifier named, or the importer's own project.
 *
 * @param graph - The graph the edge belongs to
 * @param edge - The unresolved edge
 * @param own - The importer's project
 * @returns The project's name
 */
function collapsedProject(graph: WorkspaceGraph, edge: Edge, own: string): string {
  if (edge.target.startsWith('project:')) return edge.target.slice('project:'.length)
  return graph.projectOf(edge.target.slice('file:'.length))?.name ?? own
}

/**
 * Everything a set of files reaches through edges of the given kinds.
 *
 * @param graph - The graph whose edges are followed
 * @param seeds - The files to start from, workspace-relative
 * @param kinds - The edge kinds to follow; unresolved and side-effect edges are always honoured
 * @returns The reachable files and projects, with how each was reached
 */
export function closureOf(graph: WorkspaceGraph, seeds: Iterable<string>, kinds: ReadonlySet<EdgeKind>): Closure {
  const index = indexOf(graph)
  const files = createMap<string, Hop>()
  const projects = createMap<string, Hop>()
  const touched = createSet<string>()
  const fallbacks: Fallback[] = []
  const queue: string[] = []
  const visit = (path: string, hop: Hop): void => {
    if (files.has(path)) return
    files.set(path, hop)
    queue.push(path)
    const project = index.fileProject.get(path)
    if (project !== undefined && project !== null) enter(project, path)
  }
  const collapse = (project: string, hop: Hop): void => {
    if (projects.has(project)) return
    projects.set(project, hop)
    // why: a project without a file to visit still has cycles and declared dependencies to follow.
    enter(project, hop.from)
    for (const path of index.projectFiles.get(project) as readonly string[]) visit(path, hop)
  }
  const follow = (edge: Edge, from: string | null, rule: ReasonRule | null): void => {
    const own = index.fileProject.get(edge.evidence.file) as string
    if (edge.kind === 'unresolved') {
      const fallback = edge.path === null ? Rules.ParseFailure : Rules.UnresolvedImport
      const project = collapsedProject(graph, edge, own)
      fallbacks.push({ edge, rule: fallback, project })
      collapse(project, { from, edge, rule: fallback })
      return
    }
    if (!kinds.has(edge.kind)) return
    const hop: Hop = { from, edge, rule }
    if (edge.target.startsWith('file:')) {
      const path = edge.target.slice('file:'.length)
      if (index.fileProject.has(path)) visit(path, hop)
    } else if (edge.target.startsWith('entry:')) {
      const entry = graph.entries.get(edge.target.slice('entry:'.length))
      if (entry === undefined) return
      visit(entry.file, hop)
      if (edge.kind === 're-export-all' && entry.project !== own) collapse(entry.project, { from, edge, rule: Rules.ExternalReExport })
    }
  }
  const enter = (project: string, via: string | null): void => {
    if (touched.has(project)) return
    touched.add(project)
    for (const member of index.cycles.get(project) ?? []) collapse(member, { from: via, edge: null, rule: Rules.Cycle })
    for (const dependency of (graph.projects.get(project) as ProjectRecord).implicitDependencies)
      if (graph.projects.has(dependency)) collapse(dependency, { from: via, edge: null, rule: Rules.DeclaredDependency })
    // why: a hop's `from` must be a file already in the closure, or a trace could run in a circle; the file that entered the project is.
    for (const edge of index.parseFailures.get(project) ?? []) {
      fallbacks.push({ edge, rule: Rules.ParseFailure, project })
      collapse(project, { from: via, edge, rule: Rules.ParseFailure })
    }
    for (const edge of index.sideEffects.get(project) ?? []) follow(edge, via, Rules.SideEffectImport)
  }
  for (const seed of seeds) visit(seed, { from: null, edge: null, rule: null })
  for (let at = 0; at < queue.length; at += 1) {
    const path = queue[at] as string
    for (const edge of index.outgoing.get(path) ?? []) follow(edge, path, null)
  }
  return { files, projects, touched, fallbacks }
}

/**
 * The chain of node ids from a seed of the closure to a file: each file visited, with the entry
 * an edge went through where it did.
 *
 * @param closure - The closure the file was reached in
 * @param path - The reached file
 * @returns The ids, the seed first and the file last
 */
export function traceOf(closure: Closure, path: string): string[] {
  const ids: string[] = []
  for (let current: string | null = path; current !== null; ) {
    ids.unshift(`file:${current}`)
    const hop: Hop | undefined = closure.files.get(current)
    if (hop === undefined) break
    if (hop.edge !== null && hop.edge.target.startsWith('entry:')) ids.unshift(hop.edge.target)
    current = hop.from
  }
  return ids
}

/**
 * The hop that brought a file into the closure under a fallback rule, if any: the nearest collapse
 * along the chain that reached it.
 *
 * @param closure - The closure the file was reached in
 * @param path - The reached file
 * @returns The hop carrying the rule, or null when ordinary edges reached the file
 */
export function ruleHop(closure: Closure, path: string): Hop | null {
  for (let current: string | null = path; current !== null; ) {
    const hop: Hop | undefined = closure.files.get(current)
    if (hop === undefined) return null
    if (hop.rule !== null) return hop
    current = hop.from
  }
  return null
}

/**
 * The hop through which a file entered the closure, for a reached file or a file of a collapsed
 * project.
 *
 * @param closure - The closure asked about
 * @param path - The file asked about
 * @param project - The project owning it, or null
 * @returns The hop, or null when the closure does not reach the file
 */
export function hopTo(closure: Closure, path: string, project: string | null): Hop | null {
  return closure.files.get(path) ?? (project === null ? null : (closure.projects.get(project) ?? null))
}

/**
 * The closure of every entry, following every edge kind.
 *
 * @param graph - The graph whose entries are closed over
 * @returns Each entry id to what its file reaches
 */
export function entryClosures(graph: WorkspaceGraph): Map<string, Closure> {
  const closures = createMap<string, Closure>()
  for (const [id, entry] of graph.entries) closures.set(id, closureOf(graph, [entry.file], ALL_KINDS))
  return closures
}
