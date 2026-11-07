/**
 * The `projects` rule family: lint rules that read the workspace graph, and the readers of a
 * workspace's aliases, project files and module exports that the rules and a workspace's own
 * rules share.
 *
 * @module @hyperfrontend/workspace/lint
 */

import type { RuleFamily } from '@hyperfrontend/linter'
import commandLines from './command-lines'
import dependencyChecks from './dependency-checks'
import moduleBoundaries from './module-boundaries'

export type { CommandLinesOptions } from './command-lines'
export type { DependencyChecksOptions } from './dependency-checks'
export type { DependencyConstraint, ModuleBoundariesOptions } from './module-boundaries'
export type { PathAlias } from './shared/aliases'
export type { Selector } from './shared/checked-project'
export type { Declaration, DeclarationKind, ModuleExport } from './shared/exports-index'
export type { PackageFile, ProjectFile } from './shared/project-file'
export { BASE_CONFIG, baseConfigRootOf, pathAliases } from './shared/aliases'
export { checkedProject, isNodeProject } from './shared/checked-project'
export { moduleDeclarations, moduleExports, parsedModule, resolveModule } from './shared/exports-index'
export { projectRootOf, workspaceRootOf } from './shared/locate'
export { isPublishableLibrary, isPublishableProject, readPackageFile, readProjectFile } from './shared/project-file'

/**
 * The rules of the family by name, registered under the prefix `projects` in a configuration:
 * `{ families: { projects: PROJECTS_FAMILY } }`.
 */
export const PROJECTS_FAMILY: RuleFamily = {
  'command-lines': commandLines,
  'dependency-checks': dependencyChecks,
  'module-boundaries': moduleBoundaries,
}
