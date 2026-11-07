/**
 * The upstream files an extraction has read so far, and how a module specifier is resolved among
 * them: to a file, to files not read yet, or to a boundary.
 *
 * @module types-extract/sources
 */

import { posix } from 'node:path'

/** The files read so far, by path; `null` marks a path the repository was asked for and does not have. */
export type SourceFiles = Map<string, string | null>

/** A specifier that names a file already read. */
export interface ResolvedModule {
  /** The resolution's kind. */
  readonly kind: 'file'
  /** The file's path. */
  readonly path: string
}

/** A specifier that may name files not read yet. */
export interface PendingModule {
  /** The resolution's kind. */
  readonly kind: 'pending'
  /** The paths to read before the specifier can be resolved. */
  readonly paths: readonly string[]
}

/** A specifier naming a package or a module outside the followed directories. */
export interface ExternalModule {
  /** The resolution's kind. */
  readonly kind: 'external'
}

/** A relative specifier inside the followed directories that no file answers. */
export interface MissingModule {
  /** The resolution's kind. */
  readonly kind: 'missing'
}

/** What a module specifier resolves to. */
export type ModuleResolution = ResolvedModule | PendingModule | ExternalModule | MissingModule

/**
 * The key a repository file is read under: the source's name, then the path within the repository,
 * so files of different sources never collide. Every key is POSIX, whatever the host.
 *
 * @param source - The source's name
 * @param path - The path within the repository
 * @returns The key
 */
export function sourcePath(source: string, path: string): string {
  return posix.join(source, path)
}

/**
 * The path within the repository of a file read under a source key.
 *
 * @param key - A key made by `sourcePath`
 * @returns The path after the source's name
 */
export function repositoryPath(key: string): string {
  return key.slice(key.indexOf(posix.sep) + 1)
}

/**
 * Whether a specifier is a relative path.
 *
 * @param specifier - The specifier as written
 * @returns True for `./` and `../` specifiers
 */
export function isRelativeSpecifier(specifier: string): boolean {
  return specifier.startsWith('./') || specifier.startsWith('../')
}

/**
 * The files a relative specifier may name, in resolution order.
 *
 * @param fromPath - The importing file's path
 * @param specifier - The relative specifier
 * @returns The candidate paths
 */
export function moduleCandidates(fromPath: string, specifier: string): string[] {
  const base = posix.normalize(posix.join(posix.dirname(fromPath), specifier.replace(/\.js$/, '')))
  return [`${base}.ts`, `${base}.d.ts`, `${base}/index.ts`, `${base}/index.d.ts`]
}

/**
 * Resolves a specifier among the files read so far. A candidate that has not been read yet keeps
 * the answer pending, because a file earlier in resolution order wins over one later in it.
 *
 * @param files - The files read so far
 * @param fromPath - The importing file's path
 * @param specifier - The specifier as written
 * @param include - The directory prefixes within which files are followed
 * @returns The resolution
 */
export function resolveModule(files: SourceFiles, fromPath: string, specifier: string, include: readonly string[]): ModuleResolution {
  if (!isRelativeSpecifier(specifier)) return { kind: 'external' }
  const candidates = moduleCandidates(fromPath, specifier).filter((candidate) => include.some((prefix) => candidate.startsWith(prefix)))
  if (candidates.length === 0) return { kind: 'external' }
  const pending: string[] = []
  for (const candidate of candidates) {
    if (!files.has(candidate)) {
      pending.push(candidate)
      continue
    }
    if (files.get(candidate) !== null) return pending.length === 0 ? { kind: 'file', path: candidate } : { kind: 'pending', paths: pending }
  }
  return pending.length === 0 ? { kind: 'missing' } : { kind: 'pending', paths: pending }
}
