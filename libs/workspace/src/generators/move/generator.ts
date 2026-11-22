/**
 * The `move` generator: a project relocated under another directory, its configuration files
 * pointed back at the root from there, and its names, aliases and references brought along.
 *
 * @module generators/move/generator
 */

import type { Tree } from '../../runner/contract'
import type { MoveGeneratorOptions } from './options'
import { posix } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { logger } from '../../executors/shared/logger'
import { renameE2eProjects } from '../shared/e2e-project'
import { formatWhere } from '../shared/format'
import { assertRenameFree } from '../shared/rename-refusals'
import {
  carriedOver,
  copyDirectory,
  deleteDirectory,
  planMove,
  updateContentReferences,
  updateLintConfig,
  updatePackageJson,
  updateProjectJson,
  updateProjectReferences,
  updateTsConfigJson,
  updateTsConfigLibJson,
  updateTsConfigPaths,
  updateTsConfigSpecJson,
} from './lib/move-helpers'

/**
 * Moves a project: copies its files under the destination, rewrites its manifests and the
 * configuration files that point back at the root, moves its aliases, renames it in the
 * configurations that refer to it and in the projects that test it, and deletes the old
 * directory. A file the move has nothing to change in is copied, or left, as it is written, and
 * formatting passes over it.
 *
 * @param tree - The tree, rooted at the workspace
 * @param options - Which project, where to, and whether its names follow
 * @returns Resolves when the move is written
 * @throws {Error} When the destination is the current directory, lies inside it or already exists, or a name the project, its package or a project that tests it would take is in use
 *
 * @example Move a library under another directory
 * ```bash
 * npx hf generate move my-utils libs/utils
 * ```
 *
 * @example Move and rename it
 * ```bash
 * npx hf generate move my-utils libs/utils --newName=data
 * ```
 *
 * @example Move it without changing its names
 * ```bash
 * npx hf generate move my-utils libs/utils --updateName=false
 * ```
 */
export async function moveGenerator(tree: Tree, options: MoveGeneratorOptions): Promise<void> {
  const plan = planMove(tree, options)
  if (plan.currentProjectRoot === plan.newProjectRoot) throw createError('Source and destination cannot be the same')
  // why: a copy under the directory it is copied from would be deleted with it
  if (plan.newProjectRoot.startsWith(`${plan.currentProjectRoot}${posix.sep}`))
    throw createError(`Destination lies inside the project: ${plan.newProjectRoot}`)
  if (tree.exists(plan.newProjectRoot)) throw createError(`Destination already exists: ${plan.newProjectRoot}`)
  assertRenameFree(tree, {
    projectRoot: plan.currentProjectRoot,
    currentProjectName: plan.projectName,
    newProjectName: plan.newProjectName,
    currentPackageName: plan.currentPackageName,
    newPackageName: plan.newPackageName,
  })
  copyDirectory(tree, plan.currentProjectRoot, plan.newProjectRoot)
  updateProjectJson(tree, plan)
  updatePackageJson(tree, plan)
  updateLintConfig(tree, plan)
  updateTsConfigJson(tree, plan)
  updateTsConfigLibJson(tree, plan)
  updateTsConfigSpecJson(tree, plan)
  updateTsConfigPaths(tree, plan)
  updateProjectReferences(tree, plan)
  updateContentReferences(tree, plan)
  // why: a file the move only carried to its new place is not the move's to reformat, and what it was copied from is gone once the old directory is deleted
  const carried = carriedOver(tree, plan)
  deleteDirectory(tree, plan.currentProjectRoot)
  logger.info(`Moved project from ${plan.currentProjectRoot} to ${plan.newProjectRoot}`)
  const { currentPackageName, newPackageName } = plan
  const renamedProject = plan.projectName !== plan.newProjectName
  const renamedPackage = currentPackageName !== newPackageName
  if (renamedProject) logger.info(`Project renamed from ${plan.projectName} to ${plan.newProjectName}`)
  if (renamedPackage) logger.info(`Package name changed from ${currentPackageName} to ${newPackageName}`)
  // why: a project that tests the library names it twice, by its project and by the package it installs, and either may have changed alone
  if ((renamedProject || renamedPackage) && currentPackageName !== undefined && newPackageName !== undefined) {
    const e2eRoots = renameE2eProjects(tree, {
      currentProjectName: plan.projectName,
      newProjectName: plan.newProjectName,
      currentPackageName,
      newPackageName,
    })
    for (const e2eRoot of e2eRoots)
      logger.info(`The project testing the package was brought along in ${e2eRoot}; its directory was not moved`)
  }
  if (!options.skipFormat) await formatWhere(tree, (path) => !carried.includes(path))
}

export default moveGenerator
