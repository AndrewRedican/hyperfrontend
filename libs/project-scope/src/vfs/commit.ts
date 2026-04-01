import type { Tree, CommitOptions, CommitResult, FileChange } from './types'
import { writeFileSync, unlinkSync, rmSync, chmodSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { exists, ensureDir } from '../core/fs'
import { createScopedLogger } from '../core/logger'

const vfsLogger = createScopedLogger('project-scope:vfs')

/**
 * Commit buffered changes to disk.
 *
 * @param tree - Virtual file system tree with pending modifications
 * @param options - Configuration for dry-run and verbosity
 * @returns Result of the commit operation
 *
 * @example
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
    for (const change of changes) {
      switch (change.type) {
        case 'CREATE':
          result.created++
          break
        case 'UPDATE':
          result.updated++
          break
        case 'DELETE':
          result.deleted++
          break
      }
    }
    result.changes = changes
    return result
  }

  const sortedChanges = [...changes].sort((a, b) => {
    const order = { DELETE: 0, CREATE: 1, UPDATE: 2 }
    return order[a.type] - order[b.type]
  })

  for (const change of sortedChanges) {
    const absPath = join(tree.root, change.path)

    try {
      switch (change.type) {
        case 'CREATE':
        case 'UPDATE':
          /* istanbul ignore if -- content is always defined for CREATE/UPDATE from tree.write() */
          if (change.content !== undefined) {
            const dir = dirname(absPath)
            ensureDir(dir)

            writeFileSync(absPath, change.content)

            if (change.mode !== undefined) {
              chmodSync(absPath, change.mode)
            }

            if (change.type === 'CREATE') {
              result.created++
            } else {
              result.updated++
            }
          }
          break

        case 'DELETE':
          if (exists(absPath)) {
            try {
              unlinkSync(absPath)
            } catch {
              rmSync(absPath, { recursive: true })
            }
          }
          result.deleted++
          break
      }

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
 */
export function rollbackChanges(tree: Tree): void {
  tree.clearChanges()
}
