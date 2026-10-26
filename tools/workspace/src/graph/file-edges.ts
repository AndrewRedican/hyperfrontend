/**
 * The qualified edge one import draws: from the importing file to the file, entry or installed
 * package it resolves to, carrying the import's form, the importing file's role, the specifier
 * with its resolution, and the position the import stands at.
 *
 * @module graph/file-edges
 */

import type { Edge, EntryNode, FileImport, ProjectRecord, Resolution } from './model'
import { nodeId } from './model'
import { roleOf } from './roles'

/** What the file edges of a workspace are drawn against. */
export interface FileEdgeContext {
  /** The entries every project exposes, by id. */
  readonly entries: ReadonlyMap<string, EntryNode>
  /** The installed version of each top-level package. */
  readonly versions: ReadonlyMap<string, string>
}

/**
 * The edge an import draws, or none for a Node built-in.
 *
 * @param context - The entries and versions
 * @param project - The project owning the importing file
 * @param file - The importing file, workspace-relative
 * @param item - The import
 * @param resolution - What its specifier names
 * @returns The edge, or null when the import names a built-in
 */
export function fileEdge(
  context: FileEdgeContext,
  project: ProjectRecord,
  file: string,
  item: FileImport,
  resolution: Resolution
): Edge | null {
  if (resolution.kind === 'builtin') return null
  const base = {
    source: nodeId({ kind: 'file', path: file, project: project.name, role: roleOf(file, project.root) }),
    role: roleOf(file, project.root),
    targets: [],
    evidence: { kind: 'source', file, line: item.line, column: item.column },
  } as const
  if (resolution.kind === 'npm') {
    return {
      ...base,
      target: nodeId({ kind: 'external', name: resolution.name, version: context.versions.get(resolution.name) ?? null }),
      kind: item.kind,
      path: { specifier: item.specifier, resolved: resolution.name },
    }
  }
  if (resolution.kind === 'unknown') {
    return { ...base, target: `file:${resolution.path}`, kind: 'unresolved', path: { specifier: item.specifier, resolved: null } }
  }
  if (resolution.file === null) {
    const target =
      resolution.path === null
        ? nodeId({ kind: 'project', name: resolution.project.name, root: resolution.project.root })
        : `file:${resolution.path}`
    return { ...base, target, kind: 'unresolved', path: { specifier: item.specifier, resolved: null } }
  }
  const entry = context.entries.get(item.specifier)
  const target = entry !== undefined && entry.file === resolution.file ? nodeId(entry) : `file:${resolution.file}`
  return { ...base, target, kind: item.kind, path: { specifier: item.specifier, resolved: resolution.file } }
}
