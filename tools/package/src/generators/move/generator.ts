/**
 * This repository's `move` generator: the packaged one with the project named by its new path
 * and the package named under `@hyperfrontend`, then the notes about the e2e directory and the
 * CI workflow the move leaves behind.
 *
 * @module generators/move/generator
 */

import type { Tree } from '@hyperfrontend/workspace/runner'
import type { MoveGeneratorSchema } from './schema'
import { formatFiles } from '@hyperfrontend/workspace/generators'
import { moveGenerator as move, planMove } from '@hyperfrontend/workspace/generators/move'
import { checkCIWorkflow } from '../../lib/ci-helpers'
import { noteE2EFolderMove } from '../../lib/e2e-helpers'
import { derivePackageName, deriveProjectNameFromPath } from '../../lib/naming-utils'

/**
 * Moves a project of this repository: its new name follows its new path by this repository's
 * conventions, the package is named after it under `@hyperfrontend`, and the packaged generator
 * carries both everywhere.
 *
 * @param tree - The virtual file system tree
 * @param options - Configuration options
 * @returns A promise that resolves when the generator completes
 *
 * @example Move a library to a different directory
 * ```bash
 * npx hf generate move lib-my-utils libs/utils
 * ```
 *
 * @example Move and rename a library
 * ```bash
 * npx hf generate move lib-my-utils libs/utils --newName=data
 * ```
 *
 * @example Move without changing the project name
 * ```bash
 * npx hf generate move lib-my-utils libs/utils --updateName=false
 * ```
 */
export async function moveGenerator(tree: Tree, options: MoveGeneratorSchema): Promise<void> {
  const plan = planMove(tree, options)
  const projectName = plan.updateName ? deriveProjectNameFromPath(plan.newProjectRoot) : options.project
  const packageName = derivePackageName(projectName)
  await move(tree, { ...options, projectName, packageName, skipFormat: true })
  if (plan.updateName && plan.currentPackageName !== undefined) {
    noteE2EFolderMove(tree, { currentPackageName: plan.currentPackageName, newPackageName: packageName })
  }
  checkCIWorkflow(tree, { currentProjectName: options.project, newProjectName: projectName })
  if (!options.skipFormat) await formatFiles(tree)
}

export default moveGenerator
