/**
 * The bodies the state files hold, derived from a graph in a portable form: the projects without
 * their raw manifests, the nodes by id, the qualified records in canonical order, the project
 * edges by project, the imports by path with the hash they were read from, and each entry's
 * closure with a digest of the content it can reach.
 *
 * @module graph/store/serialize
 */

import type { WorkspaceGraph } from '../build'
import type { ImportTable } from '../imports'
import type { Edge, EntryNode, FileImport, GraphNode, ProjectEdge, ProjectRecord } from '../model'
import { fromEntries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { entryClosures } from '../affected/closure'
import { isCodeFile } from '../imports'
import { compareText } from '../order'
import { sha256 } from './hashes'

/** A project as the state prints it: the record without its manifest and configuration. */
export type PrintableProject = Omit<ProjectRecord, 'manifest' | 'configuration'>

/** What the graph state file holds. */
export interface GraphBody {
  /** The projects, sorted by name. */
  readonly projects: readonly PrintableProject[]
  /** Every node, sorted by id. */
  readonly nodes: readonly GraphNode[]
  /** Every qualified edge, in canonical order. */
  readonly records: readonly Edge[]
  /** The project edges as Nx draws them, by project. */
  readonly edges: Readonly<Record<string, readonly ProjectEdge[]>>
}

/** What is remembered of one code file's imports. */
export interface ImportRecord {
  /** The hash of the content the imports were read from. */
  readonly hash: string
  /** The imports, or null for a file the parser could not read. */
  readonly imports: readonly FileImport[] | null
}

/** One entry's reach. */
export interface EntryClosure {
  /** The file the entry resolves to. */
  readonly file: string
  /** The project owning the entry. */
  readonly project: string
  /** Every file a change of which can reach the entry, sorted. */
  readonly files: readonly string[]
  /** The sha256 of the sorted `path hash` lines of those files. */
  readonly digest: string
}

/**
 * A project as the state prints it.
 *
 * @param project - The project whose fields are printed
 * @returns The record without its manifest and configuration
 */
export function printableProject(project: ProjectRecord): PrintableProject {
  const { name, root, type, tags, implicitDependencies, files } = project
  return { name, root, type, tags, implicitDependencies, files }
}

/**
 * The graph body of a graph.
 *
 * @param graph - The graph serialised
 * @returns The projects, nodes, records and edges in canonical order
 */
export function graphBody(graph: WorkspaceGraph): GraphBody {
  const names = [...graph.projects.keys()].sort(compareText)
  return {
    projects: names.map((name) => printableProject(graph.projects.get(name) as ProjectRecord)),
    nodes: [...graph.nodes].sort(([left], [right]) => compareText(left, right)).map(([, node]) => node),
    records: graph.records,
    edges: fromEntries(names.map((name) => [name, graph.edges.get(name) as readonly ProjectEdge[]])),
  }
}

/**
 * The imports body: one record per code file among the given, with the hash it was read from.
 *
 * @param imports - The imports by path
 * @param hashes - The hash of each file
 * @returns The records by path
 */
export function importsBody(imports: ImportTable, hashes: ReadonlyMap<string, string>): Record<string, ImportRecord> {
  return fromEntries(
    [...imports]
      .filter(([path]) => isCodeFile(path) && hashes.has(path))
      .sort(([left], [right]) => compareText(left, right))
      .map(([path, items]) => [path, { hash: hashes.get(path) as string, imports: items }])
  )
}

/**
 * The entries body: each entry's closure and the digest of the content it reaches.
 *
 * @param graph - The graph whose entries are closed over
 * @param hashes - The hash of each file
 * @returns The closures by entry id
 */
export function entriesBody(graph: WorkspaceGraph, hashes: ReadonlyMap<string, string>): Record<string, EntryClosure> {
  return fromEntries(
    [...entryClosures(graph)]
      .sort(([left], [right]) => compareText(left, right))
      .map(([id, closure]) => {
        const entry = graph.entries.get(id) as EntryNode
        const files = [...closure.files.keys()].sort(compareText)
        // why: a closure holds file nodes alone, and every file node was listed with its hash.
        const digest = sha256(files.map((file) => `${file} ${hashes.get(file) as string}`).join('\n'))
        return [id, { file: entry.file, project: entry.project, files, digest }]
      })
  )
}
