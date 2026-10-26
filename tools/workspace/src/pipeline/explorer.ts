/**
 * The document the dependency explorer of the docs-site draws: the persisted graph reduced to
 * what a page needs, every file edge folded into a link from its project to the entry, project,
 * package, tool or configuration it reaches, with the files behind it.
 *
 * @module pipeline/explorer
 */

import type { ConfigNode, EdgeKind, EntryNode, ExternalNode, GraphNode, ToolNode } from '../graph/model'
import type { Role } from '../graph/roles'
import type { GraphBody, PrintableProject } from '../graph/store/serialize'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { nodeId } from '../graph/model'
import { compareText } from '../graph/order'

/** The schema of the explorer document. */
export const EXPLORER_SCHEMA = 1

/** A project as the explorer draws it. */
export interface ExplorerProject {
  /** The project's name. */
  readonly name: string
  /** Its root, workspace-relative. */
  readonly root: string
  /** Its type. */
  readonly type: PrintableProject['type']
  /** Its tags. */
  readonly tags: readonly string[]
  /** Projects it declares as dependencies. */
  readonly implicitDependencies: readonly string[]
  /** How many files it has. */
  readonly files: number
}

/** An entry point a project exposes. */
export interface ExplorerEntry {
  /** `<package>` or `<package>/<subpath>`. */
  readonly id: string
  /** The project owning it. */
  readonly project: string
}

/** An installed package some project reaches. */
export interface ExplorerExternal {
  /** The package name. */
  readonly name: string
  /** The installed version, or null. */
  readonly version: string | null
}

/** A tool a target runs. */
export interface ExplorerTool {
  /** The executor or command. */
  readonly id: string
  /** The project implementing it, or null for an installed tool. */
  readonly project: string | null
}

/** One file behind a link. */
export interface ExplorerFile {
  /** The file, workspace-relative. */
  readonly file: string
  /** The line the edge was drawn at, or null for a configuration edge. */
  readonly line: number | null
  /** The specifier as written, or null. */
  readonly specifier: string | null
}

/** A link while its files are gathered. */
interface FoldedLink {
  /** The depending project. */
  readonly source: string
  /** The target node id. */
  readonly target: string
  /** What produced the edges. */
  readonly kind: EdgeKind
  /** The role of the files that drew them. */
  readonly role: Role
  /** The files behind the link, by file and line. */
  readonly files: Map<string, ExplorerFile>
}

/** Every edge from one project to one node of one kind and role, folded. */
export interface ExplorerLink {
  /** The depending project. */
  readonly source: string
  /** `project:<name>`, `entry:<id>`, `external:<name>`, `tool:<id>` or `config:<path>`. */
  readonly target: string
  /** What produced the edges. */
  readonly kind: EdgeKind
  /** The role of the files that drew them. */
  readonly role: Role
  /** The files behind the link, each once, in path order. */
  readonly files: readonly ExplorerFile[]
}

/** What the dependency explorer draws. */
export interface ExplorerDocument {
  /** The schema. */
  readonly schema: typeof EXPLORER_SCHEMA
  /** The commit the graph was built from. */
  readonly sha: string
  /** When the document was written, epoch milliseconds. */
  readonly generatedAt: number
  /** The projects, by name. */
  readonly projects: readonly ExplorerProject[]
  /** The entries, by id. */
  readonly entries: readonly ExplorerEntry[]
  /** The packages some link reaches, by name. */
  readonly externals: readonly ExplorerExternal[]
  /** The tools some link reaches, by id. */
  readonly tools: readonly ExplorerTool[]
  /** The configuration files some link reaches, by path. */
  readonly configs: readonly string[]
  /** The links, in canonical order. */
  readonly links: readonly ExplorerLink[]
}

/**
 * The project a file node belongs to, or the id of any other node.
 *
 * @param id - A node id
 * @param nodes - The nodes by id
 * @returns `project:<name>` for a file, the id itself otherwise, or null for a file no project owns
 */
function ownerOf(id: string, nodes: ReadonlyMap<string, GraphNode>): string | null {
  const node = nodes.get(id)
  if (node?.kind === 'file') return node.project === null ? null : `project:${node.project}`
  return id
}

/**
 * The explorer document of a graph body.
 *
 * @param body - The persisted graph
 * @param sha - The commit it was built from
 * @param generatedAt - When the document is written
 * @returns The document, every list sorted
 */
export function explorerDocument(body: GraphBody, sha: string, generatedAt: number): ExplorerDocument {
  const nodes = createMap<string, GraphNode>()
  for (const node of body.nodes) nodes.set(nodeId(node), node)
  const links = createMap<string, FoldedLink>()
  const reached = createMap<string, GraphNode>()
  for (const record of body.records) {
    const source = ownerOf(record.source, nodes)
    const target = ownerOf(record.target, nodes)
    if (source === null || target === null || !source.startsWith('project:') || source === target) continue
    const targetNode = nodes.get(target)
    if (targetNode !== undefined && targetNode.kind !== 'project') reached.set(target, targetNode)
    const key = `${source}\u0000${target}\u0000${record.kind}\u0000${record.role}`
    const link = links.get(key) ?? {
      source: source.slice('project:'.length),
      target,
      kind: record.kind,
      role: record.role,
      files: createMap(),
    }
    const { evidence } = record
    const fileKey = `${evidence.file}:${evidence.kind === 'source' ? evidence.line : ''}`
    if (!link.files.has(fileKey))
      link.files.set(fileKey, {
        file: evidence.file,
        line: evidence.kind === 'source' ? evidence.line : null,
        specifier: record.path?.specifier ?? null,
      })
    links.set(key, link)
  }
  const byPath = (left: ExplorerFile, right: ExplorerFile): number =>
    compareText(left.file, right.file) || (left.line ?? 0) - (right.line ?? 0)
  const reachedNodes = [...reached.values()]
  return {
    schema: EXPLORER_SCHEMA,
    sha,
    generatedAt,
    projects: body.projects.map(({ name, root, type, tags, implicitDependencies, files }) => ({
      name,
      root,
      type,
      tags,
      implicitDependencies,
      files: files.length,
    })),
    entries: body.nodes.filter((node): node is EntryNode => node.kind === 'entry').map((node) => ({ id: node.id, project: node.project })),
    externals: reachedNodes
      .filter((node): node is ExternalNode => node.kind === 'external')
      .map((node) => ({ name: node.name, version: node.version }))
      .sort((left, right) => compareText(left.name, right.name)),
    tools: reachedNodes
      .filter((node): node is ToolNode => node.kind === 'tool')
      .map((node) => ({ id: node.id, project: node.project }))
      .sort((left, right) => compareText(left.id, right.id)),
    configs: reachedNodes
      .filter((node): node is ConfigNode => node.kind === 'config')
      .map((node) => node.path)
      .sort(compareText),
    links: [...links.values()]
      .map((link) => ({
        source: link.source,
        target: link.target,
        kind: link.kind,
        role: link.role,
        files: [...link.files.values()].sort(byPath),
      }))
      .sort(
        (left, right) =>
          compareText(left.source, right.source) ||
          compareText(left.target, right.target) ||
          compareText(left.kind, right.kind) ||
          compareText(left.role, right.role)
      ),
  }
}
