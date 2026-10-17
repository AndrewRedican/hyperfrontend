import type { LoadedScene } from '../models/scene'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Write a value as text that depends only on what it holds.
 *
 * Keys are sorted, so two objects built in a different order read the same, and
 * an absent field reads the same as one set to undefined. A function is written
 * as its source, because a hook a scene declares is part of what it records.
 *
 * @param value - Anything a scene definition holds.
 * @returns The canonical text.
 */
function canonical(value: unknown): string {
  if (typeof value === 'function') {
    return stringify(String(value))
  }
  if (isArray(value)) {
    return `[${value.map(canonical).join(',')}]`
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const fields = keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${stringify(key)}:${canonical(record[key])}`)
    return `{${fields.join(',')}}`
  }
  return stringify(value) ?? 'null'
}

/**
 * Shorten a SHA-256 digest of some text or bytes.
 *
 * Only the first sixteen hex characters are kept: the digest is compared, not
 * relied on for anything else, and a short one keeps the record readable.
 *
 * @param input - What to digest.
 * @returns A short hex digest.
 */
function shortDigest(input: string | Uint8Array): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 16)
}

/**
 * Digest a scene file as written.
 *
 * @param filePath - Absolute path of the scene file.
 * @returns A short hex digest of its bytes.
 */
export function digestFile(filePath: string): string {
  return shortDigest(readFileSync(filePath))
}

/**
 * Digest what one scene was recorded from, so a stale asset can be told from a current one.
 *
 * A file that exports one scene is digested whole: any edit to it can change
 * that scene. A file that exports a list is a table driving many scenes, and an
 * edit to one row must not make every other row look stale, so each scene in it
 * is digested from its own definition instead, configuration included. A shared
 * value the file changes, a profile or a loop length, still reaches every scene
 * that carries it.
 *
 * @param loaded - The scene and the file it came from.
 * @returns A short hex digest.
 */
export function digestScene(loaded: LoadedScene): string {
  return loaded.sharesFile ? shortDigest(canonical(loaded.scene)) : digestFile(loaded.filePath)
}
