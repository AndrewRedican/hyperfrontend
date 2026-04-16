import type { Tree } from '@nx/devkit'
import type { MoveGeneratorSchema } from './schema'
import { formatFiles } from '@nx/devkit'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { checkCIWorkflow } from '../../lib/ci-helpers'
import { checkE2EProject } from '../../lib/e2e-helpers'
import { logger } from '../../lib/logger'
import {
  copyDirectory,
  deleteDirectory,
  normalizeOptions,
  updateContentReferences,
  updateEslintConfig,
  updateJestConfig,
  updatePackageJson,
  updateProjectJson,
  updateProjectReferences,
  updateTsConfigJson,
  updateTsConfigLibJson,
  updateTsConfigPaths,
  updateTsConfigSpecJson,
} from './lib/move-helpers'

/**
 * Nx generator that moves a project to a new location.
 *
 * This generator:
 * 1. Copies all project files to the new location
 * 2. Updates project.json with new paths and optionally new name
 * 3. Updates package.json with new package name (if updateName is true)
 * 4. Updates tsconfig.base.json path mappings
 * 5. Updates references in other projects
 * 6. Updates README and source file references
 * 7. Deletes the old project directory
 *
 * @param tree - The Nx virtual file system tree
 * @param options - Configuration options
 * @returns A promise that resolves when the generator completes
 *
 * @example Move a library to a different directory
 * ```bash
 * nx generate @hyperfrontend/package:move lib-my-utils libs/utils
 * ```
 *
 * @example Move and rename a library
 * ```bash
 * nx generate @hyperfrontend/package:move lib-my-utils libs/utils --newName=data
 * ```
 *
 * @example Move without changing the project name
 * ```bash
 * nx generate @hyperfrontend/package:move lib-my-utils libs/utils --updateName=false
 * ```
 */
export async function moveGenerator(tree: Tree, options: MoveGeneratorSchema): Promise<void> {
  const normalizedOptions = normalizeOptions(tree, options)

  if (normalizedOptions.currentProjectRoot === normalizedOptions.newProjectRoot) {
    throw createError('Source and destination cannot be the same')
  }

  if (tree.exists(normalizedOptions.newProjectRoot)) {
    throw createError(`Destination already exists: ${normalizedOptions.newProjectRoot}`)
  }

  copyDirectory(tree, normalizedOptions.currentProjectRoot, normalizedOptions.newProjectRoot)

  updateProjectJson(tree, normalizedOptions)
  updatePackageJson(tree, normalizedOptions)
  updateEslintConfig(tree, normalizedOptions)
  updateJestConfig(tree, normalizedOptions)
  updateTsConfigJson(tree, normalizedOptions)
  updateTsConfigLibJson(tree, normalizedOptions)
  updateTsConfigSpecJson(tree, normalizedOptions)

  updateTsConfigPaths(tree, normalizedOptions)

  updateProjectReferences(tree, normalizedOptions)

  updateContentReferences(tree, normalizedOptions)

  deleteDirectory(tree, normalizedOptions.currentProjectRoot)

  logger.info(`\nMoved project from ${normalizedOptions.currentProjectRoot} to ${normalizedOptions.newProjectRoot}`)
  if (normalizedOptions.updateName && normalizedOptions.projectName !== normalizedOptions.newProjectName) {
    logger.info(`Project renamed from ${normalizedOptions.projectName} to ${normalizedOptions.newProjectName}`)
    logger.info(`Package name changed from ${normalizedOptions.currentPackageName} to ${normalizedOptions.newPackageName}`)
  }

  checkE2EProject(tree, {
    currentPackageName: normalizedOptions.currentPackageName,
    newPackageName: normalizedOptions.newPackageName,
    updateName: normalizedOptions.updateName,
  })

  checkCIWorkflow(tree, {
    currentProjectName: normalizedOptions.projectName,
    newProjectName: normalizedOptions.newProjectName,
  })

  if (!normalizedOptions.skipFormat) {
    await formatFiles(tree)
  }
}

export default moveGenerator
