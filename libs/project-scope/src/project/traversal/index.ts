/**
 * Directory walking and file search utilities with visitor patterns for recursive exploration.
 *
 * @module @hyperfrontend/project-scope/project/traversal
 */
export type { WalkEntry, WalkOptions, WalkVisitor, WalkVisitorResult } from './walk'
export { walkDirectory, walkTree } from './walk'
export type { FindOptions } from './search'
export { findDirectories, findFiles, findFilesInTree } from './search'
