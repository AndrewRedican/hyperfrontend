/**
 * What `npm pack --dry-run --json` says a package would ship, and the content hash over the files
 * it lists, computed so two packs of the same files hash the same whatever their timestamps.
 *
 * @module artifact-drift/pack
 */

import { createHash } from 'node:crypto'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { compareText } from '../graph/order'

/** One file a pack lists. */
export interface PackedFile {
  /** The path within the package. */
  readonly path: string
  /** The size in bytes. */
  readonly size: number
}

/** What a pack says. */
export interface PackSummary {
  /** The package name. */
  readonly name: string
  /** The version. */
  readonly version: string
  /** The files, sorted by path. */
  readonly files: readonly PackedFile[]
}

/** One file as `npm pack --json` lists it. */
interface PackJsonFile {
  /** The path within the package. */
  readonly path?: string
  /** The size in bytes. */
  readonly size?: number
}

/** The JSON `npm pack --json` writes for one package. */
interface PackJson {
  /** The package name. */
  readonly name?: string
  /** The version. */
  readonly version?: string
  /** The files. */
  readonly files?: readonly PackJsonFile[]
}

/**
 * Parses the output of `npm pack --dry-run --json` for one package.
 *
 * @param output - The JSON text
 * @returns The name, version and files
 */
export function parsePackJson(output: string): PackSummary {
  const parsed = parse(output) as unknown
  const first = isArray(parsed) ? ((parsed as readonly PackJson[])[0] ?? null) : null
  if (first === null || typeof first.name !== 'string' || typeof first.version !== 'string')
    throw createError('npm pack --json named no package')
  const files = (first.files ?? [])
    .filter((file) => typeof file.path === 'string')
    .map((file) => ({ path: file.path as string, size: file.size ?? 0 }))
    .sort((left, right) => compareText(left.path, right.path))
  return { name: first.name, version: first.version, files }
}

/**
 * The content hash of a set of files: the sha256 of `path sha256(content)` lines in path order.
 *
 * @param hashes - Each path to the sha256 of its content
 * @returns The hex digest
 */
export function contentHash(hashes: ReadonlyMap<string, string>): string {
  const lines = [...hashes].sort(([left], [right]) => compareText(left, right)).map(([path, hash]) => `${path} ${hash}`)
  return createHash('sha256').update(lines.join('\n')).digest('hex')
}

/**
 * The sha256 of a file's content.
 *
 * @param content - The bytes
 * @returns The hex digest
 */
export function hashContent(content: Buffer | string): string {
  return createHash('sha256').update(content).digest('hex')
}
