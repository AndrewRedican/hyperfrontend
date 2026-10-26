/**
 * The workspace graph, built once per process for a root: the projects and their files, the
 * imports of every code file, the project edges they draw as Nx draws them, the qualified edge
 * records behind them, the npm packages each project uses, the path aliases and the installed
 * versions.
 *
 * @module graph/build
 */

import type { Edge, EdgeGroup, EntryNode, FileImport, GraphNode, NpmUse, ProjectEdge, ProjectRecord, Resolution, ToolNode } from './model'
import type { Resolver } from './resolve'
import { join } from 'node:path'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { compileGlob } from '@hyperfrontend/linter/helpers'
import { declaredEdges } from './declared-edges'
import { entriesOfProject } from './entries'
import { fileEdge } from './file-edges'
import { importsOfFiles, isCodeFile } from './imports'
import { installedPackages } from './lockfile'
import { nodeId } from './model'
import { sortEdges } from './order'
import { packagesOf, projectOfFile, resolveSpecifier } from './resolve'
import { roleOf } from './roles'
import { discoverProjects, listFiles, readAliases, readJson } from './workspace'

/** A workspace's graph. */
export interface WorkspaceGraph extends Resolver {
  /** The workspace root, absolute. */
  readonly root: string
  /** The edges by source project, then by target project and type, as Nx draws them. */
  readonly edges: ReadonlyMap<string, readonly ProjectEdge[]>
  /** The npm packages each project's files import. */
  readonly npmUses: ReadonlyMap<string, readonly NpmUse[]>
  /** The installed version of each top-level package. */
  readonly versions: ReadonlyMap<string, string>
  /** Each `name@version` installed below another package. */
  readonly nested: ReadonlySet<string>
  /** The imports of each code file. */
  readonly imports: ReadonlyMap<string, readonly FileImport[]>
  /** Every node, by id. */
  readonly nodes: ReadonlyMap<string, GraphNode>
  /** Every qualified edge, in canonical order. */
  readonly records: readonly Edge[]
  /** The qualified edges between a project and each node outside it, grouped by kind and role, by source project. */
  readonly groups: ReadonlyMap<string, readonly EdgeGroup[]>
  /** The project owning a file. */
  readonly projectOf: (file: string) => ProjectRecord | null
  /** What a specifier names, seen from a file. */
  readonly resolve: (from: string, specifier: string) => Resolution
}

/** The object form of a root manifest's workspaces. */
interface WorkspaceGlobs {
  /** The globs. */
  readonly packages?: readonly string[]
}

/** The root manifest, as far as the workspaces are read. */
interface RootManifest {
  /** The package-manager workspaces: globs, or an object holding them. */
  readonly workspaces?: readonly string[] | WorkspaceGlobs
}

/** The graphs built so far, by root. */
const graphs = createMap<string, WorkspaceGraph>()

/**
 * The graph of a workspace, built on first request.
 *
 * @param root - The workspace root, absolute
 * @returns The graph, the same object on every later request
 */
export function workspaceGraph(root: string): WorkspaceGraph {
  let graph = graphs.get(root)
  if (graph === undefined) {
    graph = buildGraph(root)
    graphs.set(root, graph)
  }
  return graph
}

/**
 * The project a qualified edge's target belongs to, or the target itself for a node no project
 * holds.
 *
 * @param edge - The edge whose target is placed
 * @param nodes - Every node by id
 * @param projects - The projects by name
 * @returns `project:<name>` for a file, entry or project target; the target id otherwise
 */
function groupTarget(edge: Edge, nodes: ReadonlyMap<string, GraphNode>, projects: ReadonlyMap<string, ProjectRecord>): string {
  const node = nodes.get(edge.target)
  if (node?.kind === 'entry') return `project:${node.project}`
  if (node?.kind === 'file' || (node === undefined && edge.target.startsWith('file:'))) {
    const owner = projectOfFile(projects, edge.target.slice('file:'.length))
    return owner === null ? edge.target : `project:${owner.name}`
  }
  return edge.target
}

/**
 * The qualified edges grouped by source project, target, kind and role, edges within one project
 * left out.
 *
 * @param records - The qualified edges
 * @param nodes - Every node by id
 * @param projects - The projects by name
 * @returns The groups by source project, in the order the edges were found
 */
function groupEdges(
  records: readonly Edge[],
  nodes: ReadonlyMap<string, GraphNode>,
  projects: ReadonlyMap<string, ProjectRecord>
): Map<string, EdgeGroup[]> {
  const groups = createMap<string, EdgeGroup[]>()
  for (const edge of records) {
    const sourceNode = nodes.get(edge.source)
    const source = sourceNode?.kind === 'file' ? sourceNode.project : sourceNode?.kind === 'project' ? sourceNode.name : null
    if (source === null) continue
    const target = groupTarget(edge, nodes, projects)
    if (target === `project:${source}`) continue
    const own = groups.get(source) ?? []
    const group = own.find((candidate) => candidate.target === target && candidate.kind === edge.kind && candidate.role === edge.role)
    if (group === undefined) own.push({ source, target, kind: edge.kind, role: edge.role, files: [edge.evidence.file] })
    else if (!group.files.includes(edge.evidence.file)) (group.files as string[]).push(edge.evidence.file)
    groups.set(source, own)
  }
  return groups
}

/**
 * Builds the graph of a workspace.
 *
 * @param root - The workspace root, absolute
 * @returns The graph of projects, edges, npm uses, aliases and versions
 */
export function buildGraph(root: string): WorkspaceGraph {
  const fileList = listFiles(root)
  const files = createSet(fileList)
  const projects = discoverProjects(root, fileList)
  const aliases = readAliases(root)
  const declared = readJson<RootManifest>(join(root, 'package.json'))?.workspaces ?? []
  const globs = isArray(declared) ? (declared as readonly string[]) : ((declared as WorkspaceGlobs).packages ?? [])
  const entries = createMap<string, EntryNode>()
  const byPackage = createMap<string, ProjectRecord>()
  const nodes = createMap<string, GraphNode>()
  for (const project of projects.values()) {
    nodes.set(`project:${project.name}`, { kind: 'project', name: project.name, root: project.root })
    for (const file of project.files)
      nodes.set(`file:${file}`, { kind: 'file', path: file, project: project.name, role: roleOf(file, project.root) })
    for (const entry of entriesOfProject(project, aliases, files)) {
      entries.set(entry.id, entry)
      nodes.set(nodeId(entry), entry)
    }
    const name = project.manifest?.name
    if (name !== undefined && !byPackage.has(name)) byPackage.set(name, project)
  }
  const resolver: Resolver = { root, files, projects, aliases, packages: packagesOf(globs.map(compileGlob), projects), entries }
  const imports = importsOfFiles(root, fileList)
  const installed = installedPackages(root)
  const edges = createMap<string, ProjectEdge[]>()
  const npmUses = createMap<string, NpmUse[]>()
  const records: Edge[] = []
  const tools = createMap<string, ToolNode>()
  const context = { root, projects, byPackage, versions: installed.hoisted, files, tools, entries }
  for (const project of projects.values()) {
    const own: ProjectEdge[] = []
    const uses = createMap<string, string[]>()
    for (const dependency of project.implicitDependencies)
      own.push({ source: project.name, target: dependency, type: 'implicit', files: [] })
    for (const file of project.files) {
      if (!isCodeFile(file)) continue
      // why: the file list can name a tracked file the working tree has deleted, which has no imports to read.
      for (const item of imports.get(file) ?? []) {
        const resolution = resolveSpecifier(resolver, file, item.specifier)
        const record = fileEdge(context, project, file, item, resolution)
        if (record !== null) {
          records.push(record)
          if (!nodes.has(record.target) && record.target.startsWith('external:') && resolution.kind === 'npm')
            nodes.set(record.target, { kind: 'external', name: resolution.name, version: installed.hoisted.get(resolution.name) ?? null })
        }
        if (resolution.kind === 'npm') {
          const list = uses.get(resolution.name) ?? []
          if (!list.includes(file)) list.push(file)
          uses.set(resolution.name, list)
          continue
        }
        // why: Nx keeps an edge into the workspace's own root project only when the root project draws it.
        if (resolution.kind !== 'project' || resolution.project === project || (resolution.project.root === '.' && project.root !== '.'))
          continue
        const type = item.dynamic ? 'dynamic' : 'static'
        const existing = own.find((edge) => edge.target === resolution.project.name && edge.type === type)
        if (existing === undefined) own.push({ source: project.name, target: resolution.project.name, type, files: [file] })
        else if (!existing.files.includes(file)) (existing.files as string[]).push(file)
      }
    }
    const configured = declaredEdges(context, project)
    records.push(...configured.edges)
    for (const node of configured.nodes) nodes.set(nodeId(node), node)
    edges.set(project.name, own)
    npmUses.set(
      project.name,
      [...uses].map(([name, list]) => ({ name, files: list }))
    )
  }
  return {
    ...resolver,
    edges,
    npmUses,
    versions: installed.hoisted,
    nested: installed.nested,
    imports,
    nodes,
    records: sortEdges(records),
    groups: groupEdges(records, nodes, projects),
    projectOf: (file) => projectOfFile(projects, file),
    resolve: (from, specifier) => resolveSpecifier(resolver, from, specifier),
  }
}
