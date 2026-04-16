import type { Tree } from '@nx/devkit'
import { logger } from './logger'

/**
 * Options for CI workflow checking.
 */
export interface CICheckOptions {
  /** Current project name */
  currentProjectName: string
  /** New project name */
  newProjectName: string
}

/**
 * Check for a CI workflow file and warn if it needs renaming.
 * Logs warnings when a status workflow file exists and the project is being renamed.
 *
 * @param tree - The virtual file system tree
 * @param options - Options containing current and new project names
 */
export function checkCIWorkflow(tree: Tree, options: CICheckOptions): void {
  if (options.currentProjectName === options.newProjectName) {
    return
  }

  const currentWorkflowPath = `.github/workflows/ci-${options.currentProjectName}.yml`

  if (!tree.exists(currentWorkflowPath)) {
    return
  }

  const newWorkflowPath = `.github/workflows/ci-${options.newProjectName}.yml`

  logger.warn('')
  logger.warn('=== CI Workflow Update Required ===')
  logger.warn(`CI workflow found at: ${currentWorkflowPath}`)
  logger.warn('Please manually update the CI workflow:')
  logger.warn(`  1. Rename ${currentWorkflowPath} to ${newWorkflowPath}`)
  logger.warn(`  2. Update workflow name and project-name inside ${newWorkflowPath}`)
  logger.warn(`  3. Update the path filter in .github/workflows/ci-libraries.yml`)
  logger.warn('')
}
