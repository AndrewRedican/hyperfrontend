/**
 * Virtual filesystem with transactional tree operations, diff generation, and commit/rollback support.
 *
 * @module @hyperfrontend/project-scope/vfs
 */
export type { DiffOptions } from './diff'
export type { MemoryTreeFiles, MemoryTreeOptions } from './memory-tree'
export type { CommitOptions, CommitResult, CreateTreeOptions, DiffLine, FileChange, FileDiff, ModeType, Tree, WriteOptions } from './types'
export { commitChanges, rollbackChanges } from './commit'
export { formatUnifiedDiff, generateAllDiffs, generateDiff } from './diff'
export { createTree, createTreeFromDisk } from './factory'
export { createFsTree } from './fs-tree'
export { createMemoryTree } from './memory-tree'
export { Mode } from './types'
