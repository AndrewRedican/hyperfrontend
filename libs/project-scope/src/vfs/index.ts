/**
 * Virtual filesystem with transactional tree operations, diff generation, and commit/rollback support.
 *
 * @module @hyperfrontend/project-scope/vfs
 */
export { createTree, createTreeFromDisk } from './factory'
export { createFsTree } from './fs-tree'
export { commitChanges, rollbackChanges } from './commit'
export type { DiffOptions } from './diff'
export { formatUnifiedDiff, generateAllDiffs, generateDiff } from './diff'
export type { CommitOptions, CommitResult, CreateTreeOptions, DiffLine, FileChange, FileDiff, ModeType, Tree, WriteOptions } from './types'
export { Mode } from './types'
