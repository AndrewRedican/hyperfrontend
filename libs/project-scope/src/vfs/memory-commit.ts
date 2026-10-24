import type { FileChange, Tree } from './types'
import { symbolFor } from '@hyperfrontend/immutable-api-utils/built-in-copy/symbol'

/**
 * Key under which a tree held in memory carries the function that applies a committed change
 * to its own files. A registered symbol, so a tree built by one bundled copy of this package
 * is still recognised by `commitChanges` from another.
 */
export const MEMORY_COMMIT = symbolFor('hyperfrontend.project-scope.memoryCommit')

/**
 * Applies one committed change to the files of a tree held in memory.
 */
export type MemoryCommit = (change: FileChange) => void

/**
 * Reads the in-memory commit function a tree carries, if it is held in memory.
 *
 * @param tree - The tree being committed
 * @returns The function, or undefined for a tree backed by a disk
 *
 * @example Telling a memory tree from a disk tree
 * ```typescript
 * memoryCommitOf(createMemoryTree()) // a function
 * memoryCommitOf(createTree('.')) // undefined
 * ```
 */
export function memoryCommitOf(tree: Tree): MemoryCommit | undefined {
  return (tree as unknown as Record<symbol, MemoryCommit | undefined>)[MEMORY_COMMIT]
}
