/**
 * The lock file that pins each source to the commit its declarations were read at, so a check
 * compares against the same upstream bytes until the lock is deliberately updated.
 *
 * @module types-extract/lock
 */

import type { TypesExtractConfig } from './config'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { entries, fromEntries, keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/** One source as locked. */
export interface LockedSource {
  /** The repository, as `owner/name`. */
  readonly repo: string
  /** The ref as configured when the commit was resolved. */
  readonly ref: string
  /** The commit the ref resolved to. */
  readonly sha: string
}

/** The sources an extraction read, each pinned to the commit it was read at. */
export interface LockFile {
  /** The locked sources, by name. */
  readonly sources: Readonly<Record<string, LockedSource>>
}

/** A lock file before its sources are checked. */
interface LockShape {
  /** The sources, when the file has them. */
  readonly sources?: unknown
}

/**
 * Parses a lock file.
 *
 * @param text - The file's text
 * @returns The pinned sources, by name
 * @throws {Error} When the text is not a lock file
 */
export function parseLock(text: string): LockFile {
  let value: unknown
  try {
    value = parse(text)
  } catch {
    throw createError('the lock file is not JSON')
  }
  if (typeof value !== 'object' || value === null || isArray(value)) throw createError('the lock file must hold an object')
  const sources = (value as LockShape).sources
  if (typeof sources !== 'object' || sources === null) throw createError('the lock file must hold a "sources" object')
  for (const [name, source] of entries(sources as Record<string, unknown>)) {
    const fields = source as Partial<Record<keyof LockedSource, unknown>> | null
    if (
      typeof fields !== 'object' ||
      fields === null ||
      typeof fields.repo !== 'string' ||
      typeof fields.ref !== 'string' ||
      typeof fields.sha !== 'string'
    ) {
      throw createError(`the lock file's source ${name} must carry repo, ref and sha`)
    }
  }
  return { sources: sources as Record<string, LockedSource> }
}

/**
 * Serialises a lock file with its sources in name order.
 *
 * @param lock - The sources to pin
 * @returns The text, ending in a newline
 */
export function serializeLock(lock: LockFile): string {
  const sorted = fromEntries(
    keys(lock.sources)
      .sort()
      .map((name) => {
        const source = lock.sources[name] as LockedSource
        return [name, { repo: source.repo, ref: source.ref, sha: source.sha }]
      })
  )
  return `${stringify({ sources: sorted }, null, 2)}\n`
}

/**
 * The configured sources the lock does not pin as configured: absent from the lock, or locked at
 * another repository or ref.
 *
 * @param lock - The lock, or null when there is none
 * @param config - The configuration
 * @returns The names of the sources that need resolving
 */
export function staleSources(lock: LockFile | null, config: TypesExtractConfig): string[] {
  return keys(config.sources).filter((name) => {
    const configured = config.sources[name]
    const locked = lock?.sources[name]
    return locked === undefined || locked.repo !== configured?.repo || locked.ref !== configured.ref
  })
}
