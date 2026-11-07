/**
 * The `library` generator: creates a TypeScript library of the workspace, and hands a publishable one to `make-publishable`.
 *
 * @module @hyperfrontend/workspace/generators/library
 */

export type { LibraryPlan } from './generator'
export type { LibraryGeneratorOptions } from './options'
export { libraryGenerator, libraryGenerator as default, planLibrary } from './generator'
