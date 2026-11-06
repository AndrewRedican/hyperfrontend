/**
 * What a build must redo given the persisted state and the workspace now: nothing when the meta
 * and the file list agree, the changed and added code files when only files differ, and everything
 * when there is no state or the meta differs; imports are reused by content hash whenever the
 * reader that wrote them is the reader running.
 *
 * @module graph/store/invalidate
 */

import type { FileRecord } from './files'
import type { GraphMeta } from './meta'
import type { ImportRecord } from './serialize'
import type { PersistedState } from './state'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { isCodeFile } from '../imports'
import { hashesByPath } from './files'
import { metaDifferences } from './meta'

/** How much of a build is redone. */
export const UpdateMode = freeze({
  Cold: 'cold',
  Incremental: 'incremental',
  Warm: 'warm',
} as const)

/** One of the update modes. */
export type UpdateMode = (typeof UpdateMode)[keyof typeof UpdateMode]

/** What a build will do. */
export interface UpdatePlan {
  /** How much is redone. */
  readonly mode: UpdateMode
  /** Why: the missing state, the meta keys that differ, or the counts of changed files. */
  readonly reasons: readonly string[]
  /** The files added since the state was written. */
  readonly added: readonly string[]
  /** The files whose content changed. */
  readonly changed: readonly string[]
  /** The files no longer present. */
  readonly deleted: readonly string[]
  /** The code files to parse. */
  readonly reparse: readonly string[]
  /** The import records to reuse, by path. */
  readonly reuse: ReadonlyMap<string, ImportRecord>
}

/** The meta keys whose change means the persisted imports were read by another reader. */
const READER_KEYS = freeze(['schema', 'reader', 'algorithm', 'node'] as const)

/**
 * Plans a build.
 *
 * @param previous - The persisted state, or null when there is none to build on
 * @param meta - The meta a build would write now
 * @param files - The workspace's files with their hashes
 * @returns What to reparse, what to reuse and why
 */
export function planUpdate(previous: PersistedState | null, meta: GraphMeta, files: readonly FileRecord[]): UpdatePlan {
  const code = files.map((record) => record.path).filter(isCodeFile)
  if (previous === null)
    return { mode: 'cold', reasons: ['no persisted state'], added: [], changed: [], deleted: [], reparse: code, reuse: createMap() }
  const differences = metaDifferences(previous.meta, meta)
  const before = hashesByPath(previous.files.files)
  const now = hashesByPath(files)
  const added = files.filter((record) => !before.has(record.path)).map((record) => record.path)
  const changed = files.filter((record) => before.has(record.path) && before.get(record.path) !== record.hash).map((record) => record.path)
  const deleted = previous.files.files.filter((record) => !now.has(record.path)).map((record) => record.path)
  const sameReader = !differences.some((key) => (READER_KEYS as readonly string[]).includes(key))
  const reuse = createMap<string, ImportRecord>()
  if (sameReader) {
    for (const path of code) {
      const record = previous.imports.files[path]
      if (record !== undefined && record.hash === now.get(path)) reuse.set(path, record)
    }
  }
  const reparse = code.filter((path) => !reuse.has(path))
  const mode = differences.length > 0 ? 'cold' : added.length + changed.length + deleted.length === 0 ? 'warm' : 'incremental'
  const reasons =
    mode === 'cold'
      ? differences
      : mode === 'warm'
        ? ['nothing changed']
        : [`${added.length} added`, `${changed.length} changed`, `${deleted.length} deleted`]
  return { mode, reasons, added, changed, deleted, reparse, reuse }
}
