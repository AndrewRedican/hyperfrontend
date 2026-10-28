/**
 * The hashes the persisted state rests on: git's blob id for a file, computed by git itself so a
 * checkout's line-ending filters apply as they apply to the index; a sha256 digest of a canonical
 * JSON body, keys sorted so two writers agree byte for byte; and a hash of a directory of sources
 * naming the algorithm that wrote the state.
 *
 * @module graph/store/hashes
 */

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { entries, fromEntries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { compareText } from '../order'

/** The largest output git may answer with. */
const LIST_BUFFER = 64 * 1024 * 1024

/**
 * A value with the keys of every object in it sorted, so its JSON text is canonical.
 *
 * @param value - Any JSON value
 * @returns The same value with sorted keys
 */
function sortKeys(value: unknown): unknown {
  if (isArray(value)) return (value as readonly unknown[]).map(sortKeys)
  if (value === null || typeof value !== 'object') return value
  return fromEntries(
    entries(value as Readonly<Record<string, unknown>>)
      .sort(([left], [right]) => compareText(left, right))
      .map(([key, item]) => [key, sortKeys(item)])
  )
}

/**
 * The canonical JSON text of a value: keys sorted at every depth, no whitespace.
 *
 * @param value - Any JSON value
 * @returns The text
 */
export function canonicalJson(value: unknown): string {
  return stringify(sortKeys(value))
}

/**
 * The sha256 of a text or buffer, as hex.
 *
 * @param content - What to hash
 * @returns The hex digest
 */
export function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex')
}

/**
 * The digest of a JSON body: the sha256 of its canonical text.
 *
 * @param body - Any JSON value
 * @returns The hex digest
 */
export function digestOf(body: unknown): string {
  return sha256(canonicalJson(body))
}

/**
 * The blob ids git would store for files of the working tree, with the checkout's filters applied,
 * so a file hashed here agrees with the index entry of the same content.
 *
 * @param root - The workspace root, absolute
 * @param paths - The files, workspace-relative and POSIX
 * @returns Each path to its blob id
 */
export function blobHashes(root: string, paths: readonly string[]): Map<string, string> {
  const hashes = createMap<string, string>()
  if (paths.length === 0) return hashes
  const output = execFileSync('git', ['hash-object', '--stdin-paths'], {
    cwd: root,
    encoding: 'utf8',
    input: `${paths.join('\n')}\n`,
    maxBuffer: LIST_BUFFER,
  })
  const ids = output.trim().split(/\r?\n/)
  paths.forEach((path, index) => hashes.set(path, ids[index] as string))
  return hashes
}

/**
 * A hash of the TypeScript sources under a directory, specs and test utilities left out, so the
 * algorithm that wrote a state is named by the code that implements it.
 *
 * @param directory - The directory, absolute
 * @returns The hex digest of every source's content, in path order
 */
export function sourcesHash(directory: string): string {
  const hash = createHash('sha256')
  const visit = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((left, right) => compareText(left.name, right.name))) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) {
        if (entry.name !== '__test-utils__') visit(path)
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) hash.update(entry.name).update(readFileSync(path))
    }
  }
  visit(directory)
  return hash.digest('hex')
}
