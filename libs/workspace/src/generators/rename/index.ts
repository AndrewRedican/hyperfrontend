/**
 * The `rename` generator: renames a project and carries the new name into everything that refers to it.
 *
 * @module generators/rename
 */

export type { RenamePlan } from './generator'
export type { RenameGeneratorOptions } from './options'
export { renameGenerator, renameGenerator as default, planRename } from './generator'
