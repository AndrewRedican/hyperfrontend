/**
 * The `workspace` generator: writes the root configuration the engine reads into a repository that has none.
 *
 * @module generators/workspace
 */

export type { WorkspaceGeneratorOptions } from './options'
export { workspaceGenerator, workspaceGenerator as default } from './generator'
