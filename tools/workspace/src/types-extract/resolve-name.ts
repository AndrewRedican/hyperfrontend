/**
 * Where a name used in one upstream file is declared: in the file, in another file reached
 * through imports and re-exports, outside the followed sources, or nowhere the extraction can see.
 *
 * @module types-extract/resolve-name
 */

import type { FileIndex } from './index-file'
import type { SourceFiles } from './sources'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { indexFile } from './index-file'
import { resolveModule } from './sources'

/** A top-level declaration in a file that has been read. */
export interface SymbolResolution {
  /** The resolution's kind. */
  readonly kind: 'symbol'
  /** The declaring file's path. */
  readonly file: string
  /** The declared name. */
  readonly name: string
}

/** A namespace import of a file that has been read. */
export interface NamespaceResolution {
  /** The resolution's kind. */
  readonly kind: 'namespace'
  /** The imported file's path. */
  readonly file: string
}

/** An export of a package or of a module outside the followed directories. */
export interface ExternalResolution {
  /** The resolution's kind. */
  readonly kind: 'external'
  /** The module specifier as written. */
  readonly module: string
  /** The exported name. */
  readonly name: string
}

/** A name no followed module exports under that name. */
export interface MissingResolution {
  /** The resolution's kind. */
  readonly kind: 'missing'
  /** The module that was expected to export it. */
  readonly module: string
  /** The name looked for. */
  readonly name: string
}

/** A name declared nowhere in the file or its imports, so a global such as `Record`. */
export interface GlobalResolution {
  /** The resolution's kind. */
  readonly kind: 'global'
  /** The name as written. */
  readonly name: string
}

/** A name whose resolution needs files not read yet. */
export interface PendingResolution {
  /** The resolution's kind. */
  readonly kind: 'pending'
  /** The paths to read first. */
  readonly paths: readonly string[]
}

/** What a name resolves to. */
export type NameResolution =
  | SymbolResolution
  | NamespaceResolution
  | ExternalResolution
  | MissingResolution
  | GlobalResolution
  | PendingResolution

/** What resolution runs against. */
export interface ResolutionContext {
  /** The files read so far. */
  readonly files: SourceFiles
  /** The directory prefixes within which files are followed. */
  readonly include: readonly string[]
  /** The indexes built so far, by path. */
  readonly indexes: Map<string, FileIndex>
}

/**
 * The index of a file that has been read, built on first use.
 *
 * @param context - The resolution context
 * @param path - The file's path
 * @returns The file's index, built once and reused
 * @throws {Error} When the file has not been read
 */
export function indexOf(context: ResolutionContext, path: string): FileIndex {
  const cached = context.indexes.get(path)
  if (cached !== undefined) return cached
  const text = context.files.get(path)
  if (typeof text !== 'string') throw createError(`${path} has not been read`)
  const index = indexFile(path, text)
  context.indexes.set(path, index)
  return index
}

/**
 * Follows an import or re-export of one name from one module.
 *
 * @param context - The resolution context
 * @param from - The importing file
 * @param module - The module specifier as written
 * @param name - The exported name wanted, or `*` for the module itself
 * @param visited - The exports already being resolved, against cycles
 * @returns The resolution
 */
function followBinding(context: ResolutionContext, from: FileIndex, module: string, name: string, visited: Set<string>): NameResolution {
  const resolution = resolveModule(context.files, from.path, module, context.include)
  if (resolution.kind === 'pending') return resolution
  if (resolution.kind === 'external' || resolution.kind === 'missing') return { kind: resolution.kind, module, name }
  if (name === '*') return { kind: 'namespace', file: resolution.path }
  return resolveExport(context, indexOf(context, resolution.path), name, visited)
}

/**
 * Where a file's export of a name is declared, following re-exports.
 *
 * @param context - The resolution context
 * @param file - The exporting file
 * @param name - The exported name
 * @param visited - The exports already being resolved, against cycles
 * @returns The resolution
 */
export function resolveExport(
  context: ResolutionContext,
  file: FileIndex,
  name: string,
  visited: Set<string> = createSet()
): NameResolution {
  const key = `${file.path}#${name}`
  if (visited.has(key)) return { kind: 'missing', module: file.path, name }
  visited.add(key)
  if (file.declarations.has(name)) return { kind: 'symbol', file: file.path, name }
  const reExport = file.reExports.find((entry) => entry.exported === name)
  if (reExport !== undefined) {
    if (reExport.module !== null) return followBinding(context, file, reExport.module, reExport.name, visited)
    if (file.declarations.has(reExport.name)) return { kind: 'symbol', file: file.path, name: reExport.name }
    const binding = file.imports.get(reExport.name)
    if (binding !== undefined) return followBinding(context, file, binding.module, binding.name, visited)
    return { kind: 'missing', module: file.path, name }
  }
  for (const module of file.starExports) {
    const found = followBinding(context, file, module, name, visited)
    if (found.kind !== 'missing') return found
  }
  return { kind: 'missing', module: file.path, name }
}

/**
 * Where a name used in a file is declared.
 *
 * @param context - The resolution context
 * @param file - The file using the name
 * @param name - The name as written
 * @returns The resolution
 */
export function resolveName(context: ResolutionContext, file: FileIndex, name: string): NameResolution {
  if (file.declarations.has(name)) return { kind: 'symbol', file: file.path, name }
  const binding = file.imports.get(name)
  if (binding === undefined) return { kind: 'global', name }
  return followBinding(context, file, binding.module, binding.name, createSet())
}
