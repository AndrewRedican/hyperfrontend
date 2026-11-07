/**
 * Where this repository keeps the project that tests a package, and the note a rename leaves
 * when that directory no longer matches the package's name.
 *
 * @module lib/e2e-helpers
 */

import type { Tree } from '@hyperfrontend/workspace/runner'
import { joinPathFragments, unscopedName } from '@hyperfrontend/workspace/generators'
import { logger } from './logger'

/** The directory every package's e2e project lives under, named after the package. */
export const E2E_DIRECTORY = 'apps/package-e2e'

/** How a package was renamed. */
export interface E2EFolderOptions {
  /** The package's current name */
  currentPackageName: string
  /** The package's new name */
  newPackageName: string
}

/**
 * Warns that the e2e project's directory still carries the package's old name, and names the
 * move that fixes it. The e2e project's files were already renamed with the package.
 *
 * @param tree - The tree the projects live in
 * @param options - The package's old and new names
 */
export function noteE2EFolderMove(tree: Tree, options: E2EFolderOptions): void {
  const currentLibName = unscopedName(options.currentPackageName)
  const newLibName = unscopedName(options.newPackageName)
  if (currentLibName === newLibName || !tree.exists(joinPathFragments(E2E_DIRECTORY, currentLibName, 'project.json'))) return
  logger.warn('')
  logger.warn('=== E2E Project Folder Move Required ===')
  logger.warn(`E2E project files updated in: ${E2E_DIRECTORY}/${currentLibName}`)
  logger.warn('Please move the folder to match the new name:')
  logger.warn(`  npx hf generate move e2e-lib-${newLibName} ${E2E_DIRECTORY} --newName=${newLibName} --updateName=false`)
  logger.warn(`  (or manually: mv ${E2E_DIRECTORY}/${currentLibName} ${E2E_DIRECTORY}/${newLibName})`)
  logger.warn('')
}
