/**
 * This repository's `rename` generator: the packaged one with the `lib-`/`tool-` prefix kept and
 * the package named under `@hyperfrontend`, then the notes about the e2e directory and the CI
 * workflow the rename leaves behind.
 *
 * @module generators/rename/generator
 */

import type { Tree } from '@hyperfrontend/workspace/runner'
import type { RenameGeneratorSchema } from './schema'
import { formatFiles } from '@hyperfrontend/workspace/generators'
import { planRename, renameGenerator as rename } from '@hyperfrontend/workspace/generators/rename'
import { checkCIWorkflow } from '../../lib/ci-helpers'
import { noteE2EFolderMove } from '../../lib/e2e-helpers'
import { derivePackageName, deriveProjectName, extractProjectPrefix } from '../../lib/naming-utils'

/**
 * Renames a project of this repository: the new name takes the project's prefix, the package
 * is named after it under `@hyperfrontend`, and the packaged generator carries both everywhere.
 * The project folder is NOT renamed; the move generator relocates a project.
 *
 * @param tree - The virtual file system tree
 * @param options - Configuration options
 * @returns A promise that resolves when the generator completes
 *
 * @example Rename a library
 * ```bash
 * npx hf generate rename lib-my-utils new-utils
 * ```
 */
export async function renameGenerator(tree: Tree, options: RenameGeneratorSchema): Promise<void> {
  const newProjectName = deriveProjectName(options.newName, extractProjectPrefix(options.project))
  const packageName = derivePackageName(newProjectName)
  const plan = planRename(tree, { project: options.project, newName: newProjectName, packageName })
  await rename(tree, { project: options.project, newName: newProjectName, packageName, skipFormat: true })
  if (plan.currentPackageName !== undefined)
    noteE2EFolderMove(tree, { currentPackageName: plan.currentPackageName, newPackageName: packageName })
  checkCIWorkflow(tree, { currentProjectName: options.project, newProjectName })
  if (!options.skipFormat) await formatFiles(tree)
}

export default renameGenerator
