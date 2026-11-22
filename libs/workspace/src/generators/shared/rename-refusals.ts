/**
 * The refusal of a rename whose names are taken: the project name and the package name a
 * project is about to take, and the names the projects that test it would take with it.
 *
 * @module generators/shared/rename-refusals
 */

import type { Tree } from './tree'
import { assertE2eRenameFree } from './e2e-project'
import { assertPackageNameFree, assertProjectNameFree } from './projects'

/** A project about to be renamed, by the names it has and the names it takes. */
export interface Renaming {
  /** The project's directory before the rename, relative to the root */
  projectRoot: string
  /** The project's current name */
  currentProjectName: string
  /** The project's new name; its current one when the project name stays */
  newProjectName: string
  /** The package's current name, or undefined for a project with no package */
  currentPackageName: string | undefined
  /** The package's new name; its current one when the package name stays, or undefined for a project with no package */
  newPackageName: string | undefined
}

/**
 * Refuses a rename that would leave two projects, or two packages, under one name: a new project
 * name another project holds, a new package name another package or an alias of the base
 * tsconfig holds, and a name a project that tests the renamed one would take from another. It
 * reads the tree as it stands before the rename, and writes nothing.
 *
 * @param tree - The tree the projects, the packages and the aliases are read from
 * @param renaming - The names the project has and the names it takes
 * @throws {Error} When a name the rename would write is already in use
 *
 * @example Before a rename or a move writes its first file
 * ```typescript
 * assertRenameFree(tree, {
 *   projectRoot: 'libs/core',
 *   currentProjectName: 'core',
 *   newProjectName: 'fresh',
 *   currentPackageName: '@acme/core',
 *   newPackageName: '@acme/core-ui',
 * })
 * // throws "Package name already in use: '@acme/core-ui' is the package at libs/core-ui"
 * ```
 */
export function assertRenameFree(tree: Tree, renaming: Renaming): void {
  const { currentProjectName, newProjectName, currentPackageName, newPackageName } = renaming
  if (newProjectName !== currentProjectName) assertProjectNameFree(tree, newProjectName)
  if (currentPackageName === undefined || newPackageName === undefined) return
  if (newPackageName !== currentPackageName) assertPackageNameFree(tree, newPackageName, renaming.projectRoot)
  assertE2eRenameFree(tree, { currentProjectName, newProjectName, currentPackageName, newPackageName })
}
