import type { Tree, CreateTreeOptions } from './types'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { exists, isDirectory } from '../core/fs'
import { createScopedLogger } from '../core/logger'
import { normalizePath } from '../core/path'
import { createFsTree } from './fs-tree'

const factoryLogger = createScopedLogger('project-scope:vfs:factory')

/**
 * Create a virtual file system tree.
 *
 * @param root - Root directory path
 * @param options - Tree creation options
 * @returns A new Tree instance
 * @throws {Error} If root doesn't exist or isn't a directory
 *
 * @example
 * ```typescript
 * import { createTree } from '@hyperfrontend/project-scope'
 *
 * const tree = createTree('./my-project')
 *
 * // Read files from tree
 * const content = tree.read('src/index.ts', 'utf-8')
 *
 * // Make changes (buffered in memory)
 * tree.write('src/new-file.ts', 'export const x = 1')
 *
 * // List pending changes
 * console.log(tree.listChanges())
 * ```
 */
export function createTree(root: string, options?: CreateTreeOptions): Tree {
  const normalizedRoot = normalizePath(root)
  factoryLogger.debug('createTree', { root: normalizedRoot })

  // Validate root exists
  if (!exists(normalizedRoot)) {
    factoryLogger.warn('createTree failed: root does not exist', { root: normalizedRoot })
    throw createError(`Root directory does not exist: ${normalizedRoot}`)
  }

  // Validate root is a directory
  if (!isDirectory(normalizedRoot)) {
    factoryLogger.warn('createTree failed: root is not a directory', { root: normalizedRoot })
    throw createError(`Root path is not a directory: ${normalizedRoot}`)
  }

  return createFsTree(normalizedRoot, options)
}

/**
 * Create a tree from disk.
 *
 * Convenience alias for createTree.
 *
 * @param root - Root directory path
 * @param options - Tree creation options
 * @returns A new Tree instance backed by disk
 */
export function createTreeFromDisk(root: string, options?: CreateTreeOptions): Tree {
  return createTree(root, options)
}
