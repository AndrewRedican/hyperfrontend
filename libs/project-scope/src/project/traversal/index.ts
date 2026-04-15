/**
 * Directory walking and file search utilities with visitor patterns for recursive exploration.
 *
 * @module @hyperfrontend/project-scope/project/traversal
 */
export type { FindOptions } from './search'
export type { WalkEntry, WalkOptions, WalkVisitor, WalkVisitorResult } from './walk'
export { findDirectories, findFiles, findFilesInTree } from './search'
export { walkDirectory, walkTree } from './walk'
