/**
 * The `move` generator: a project relocated under another directory, its configuration files
 * pointed back at the root from there, and its names, aliases and references brought along.
 *
 * @module generators/move/generator
 */

import type { Tree } from '../../runner/contract'
import type { MoveGeneratorOptions } from './options'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { logger } from '../../executors/shared/logger'
import { renameE2eProject } from '../shared/e2e-project'
import { formatFiles } from '../shared/format'
import {
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
 * configuration files that point back at the root, moves its aliases, renames it in the projects
 * that refer to it and in the project that tests it, and deletes the old directory.
 *
 * @param tree - The tree, rooted at the workspace
 * @param options - Which project, where to, and whether its names follow
 * @returns Resolves when the move is written
 * @throws {Error} When the destination is the current directory or already exists
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
  if (tree.exists(plan.newProjectRoot)) throw createError(`Destination already exists: ${plan.newProjectRoot}`)
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
  deleteDirectory(tree, plan.currentProjectRoot)
  logger.info(`Moved project from ${plan.currentProjectRoot} to ${plan.newProjectRoot}`)
  if (plan.updateName && plan.projectName !== plan.newProjectName) {
    logger.info(`Project renamed from ${plan.projectName} to ${plan.newProjectName}`)
    if (plan.currentPackageName !== undefined && plan.newPackageName !== undefined) {
      logger.info(`Package name changed from ${plan.currentPackageName} to ${plan.newPackageName}`)
      const e2eRoot = renameE2eProject(tree, {
        currentProjectName: plan.projectName,
        newProjectName: plan.newProjectName,
        currentPackageName: plan.currentPackageName,
        newPackageName: plan.newPackageName,
      })
      if (e2eRoot !== undefined) logger.info(`The project testing the package was renamed in ${e2eRoot}; its directory was not moved`)
    }
  }
  if (!options.skipFormat) await formatFiles(tree)
}

export default moveGenerator
