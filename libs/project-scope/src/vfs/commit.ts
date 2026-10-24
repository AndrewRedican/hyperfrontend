import type { Tree, CommitOptions, CommitResult, FileChange } from './types'
import { writeFileSync, unlinkSync, rmSync, chmodSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { exists, ensureDir } from '../core/fs'
import { createScopedLogger } from '../core/logger'
import { memoryCommitOf } from './memory-commit'

const vfsLogger = createScopedLogger('project-scope:vfs')

/**
 * Adds one change to a result's created, updated or deleted count.
 *
 * @param result - The result being tallied
 * @param change - The change to count
 */
function countChange(result: CommitResult, change: FileChange): void {
  if (change.type === 'CREATE') result.created++
  else if (change.type === 'UPDATE') result.updated++
  else result.deleted++
}

/**
 * Applies one change to the file system.
 *
 * @param absPath - Absolute path of the changed file
 * @param change - What to write, chmod or remove there
 */
function applyToDisk(absPath: string, change: FileChange): void {
  if (change.type === 'DELETE') {
    if (exists(absPath)) {
      try {
        unlinkSync(absPath)
      } catch {
        // why: on Windows an antivirus or indexer can still hold a file inside the directory, which surfaces as a transient EBUSY/EPERM that a short retry absorbs
        rmSync(absPath, { recursive: true, maxRetries: 3, retryDelay: 100 })
      }
    }
    return
  }

  /* istanbul ignore if -- content is always defined for CREATE/UPDATE from tree.write() */
  if (change.content === undefined) return
  ensureDir(dirname(absPath))
  writeFileSync(absPath, change.content)
  if (change.mode !== undefined) {
    chmodSync(absPath, change.mode)
  }
}

/**
 * Commit buffered changes to disk.
 *
 * A tree from `createMemoryTree` is committed into its own memory instead: its changes become
 * its new base layer, and nothing is written to disk.
 *
 * @param tree - Virtual file system tree with pending modifications
 * @param options - Configuration for dry-run and verbosity
 * @returns Result of the commit operation
 *
 * @example Committing changes to disk
 * ```typescript
 * import { createTree, commitChanges } from '@hyperfrontend/project-scope'
 *
 * const tree = createTree('./my-project')
 * tree.write('src/new-file.ts', 'export const hello = "world"')
 *
 * // Preview changes without writing
 * const preview = commitChanges(tree, { dryRun: true })
 * console.log('Would create:', preview.created, 'files')
 *
 * // Actually commit changes
 * const result = commitChanges(tree)
 * console.log('Created:', result.created, 'Updated:', result.updated)
 * ```
 */
export function commitChanges(tree: Tree, options?: CommitOptions): CommitResult {
  const changes = tree.listChanges()
  const appliedChanges: FileChange[] = []

  if (options?.verbose) {
    vfsLogger.setLogLevel('debug')
  }

  vfsLogger.debug('Committing changes', { changeCount: changes.length, dryRun: options?.dryRun })

  const result: CommitResult = {
    created: 0,
    updated: 0,
    deleted: 0,
    changes: [],
    dryRun: options?.dryRun ?? false,
  }

  if (options?.dryRun) {
    for (const change of changes) countChange(result, change)
    result.changes = changes
    return result
  }

  const sortedChanges = [...changes].sort((a, b) => {
    const order = { DELETE: 0, CREATE: 1, UPDATE: 2 }
    return order[a.type] - order[b.type]
  })

  // why: a memory tree's root names no real directory, so writing its changes there would touch whatever happens to live at that path.
  const apply = memoryCommitOf(tree) ?? ((change: FileChange) => applyToDisk(join(tree.root, change.path), change))

  for (const change of sortedChanges) {
    try {
      apply(change)
      countChange(result, change)
      appliedChanges.push(change)

      if (options?.verbose) {
        const prefix = change.type === 'CREATE' ? '+' : change.type === 'DELETE' ? '-' : '~'
        vfsLogger.info(`${prefix} ${change.path}`)
      }
    } catch (error) {
      vfsLogger.error('Commit failed', { path: change.path, type: change.type })
      const message =
        error instanceof Error
          ? `Failed to ${change.type.toLowerCase()} ${change.path}: ${error.message}`
          : `Failed to ${change.type.toLowerCase()} ${change.path}`
      throw createError(message)
    }
  }

  result.changes = appliedChanges

  tree.clearChanges()

  return result
}

/**
 * Discard all pending changes.
 *
 * @param tree - Virtual file system tree
 *
 * @example Rolling back pending changes
 * ```typescript
 * import { createTree, rollbackChanges } from '@hyperfrontend/project-scope'
 *
 * const tree = createTree('/workspace')
 * tree.write('new-file.ts', 'content')
 * // Decide to abort - discard all pending changes
 * rollbackChanges(tree)
 * ```
 */
export function rollbackChanges(tree: Tree): void {
  tree.clearChanges()
}
