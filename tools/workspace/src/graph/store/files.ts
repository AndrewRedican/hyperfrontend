/**
 * The files of a workspace with a content hash each: git's blob id from the index for a clean
 * tracked file, and the blob id git computes from the working tree for a file that is dirty or
 * untracked. A tracked file the working tree has deleted is left out, as is the state directory.
 *
 * @module graph/store/files
 */

import { execFileSync } from 'node:child_process'
import { statSync } from 'node:fs'
import { join } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { matchesAny } from '@hyperfrontend/linter/helpers'
import { compareText } from '../order'
import { nxIgnores } from '../workspace'
import { blobHashes } from './hashes'

/** The directory the state itself lives under, which never describes itself. */
const STATE_PREFIX = '.hf/'

/** One file and the hash of its content. */
export interface FileRecord {
  /** The path, workspace-relative and POSIX. */
  readonly path: string
  /** The blob id of the content. */
  readonly hash: string
}

/** The largest output git may answer with. */
const LIST_BUFFER = 64 * 1024 * 1024

/**
 * Runs git in the workspace and splits its NUL-separated output.
 *
 * @param root - The workspace root, absolute
 * @param args - The arguments after `git`
 * @returns The non-empty fields
 */
function gitFields(root: string, args: readonly string[]): string[] {
  return execFileSync('git', [...args], { cwd: root, encoding: 'utf8', maxBuffer: LIST_BUFFER })
    .split('\0')
    .filter((field) => field !== '')
}

/**
 * The files of a workspace with their hashes: those git tracks or could track, less the ignored
 * and less the tracked files the working tree no longer holds.
 *
 * @param root - The workspace root, absolute
 * @returns The records, sorted by path
 */
export function listFileRecords(root: string): FileRecord[] {
  const ignores = nxIgnores(root)
  const dirty = createSet(gitFields(root, ['diff-files', '--name-only', '-z']))
  const hashes = createMap<string, string>()
  const pending: string[] = []
  for (const field of gitFields(root, ['ls-files', '-s', '-z'])) {
    const tab = field.indexOf('\t')
    const path = field.slice(tab + 1)
    if (path.startsWith(STATE_PREFIX) || matchesAny(ignores, path) || hashes.has(path)) continue
    if (dirty.has(path)) pending.push(path)
    else hashes.set(path, field.slice(0, tab).split(' ')[1] as string)
  }
  for (const path of gitFields(root, ['ls-files', '-o', '--exclude-standard', '-z'])) {
    if (!path.startsWith(STATE_PREFIX) && !matchesAny(ignores, path)) pending.push(path)
  }
  const present = pending.filter((path) => statSync(join(root, path), { throwIfNoEntry: false })?.isFile() === true)
  for (const [path, hash] of blobHashes(root, present)) hashes.set(path, hash)
  return [...hashes].map(([path, hash]) => ({ path, hash })).sort((left, right) => compareText(left.path, right.path))
}

/**
 * Indexes the records for lookup.
 *
 * @param records - The file records
 * @returns Each path to its hash
 */
export function hashesByPath(records: readonly FileRecord[]): Map<string, string> {
  return createMap(records.map((record) => [record.path, record.hash] as const))
}
