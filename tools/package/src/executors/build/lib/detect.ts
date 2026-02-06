/**
 * Library type detection for the build executor.
 *
 * Analyzes project structure to determine if it's a standard or isomorphic library.
 */
import { joinPathFragments } from '@nx/devkit'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { LibraryType } from './types'

/**
 * Detects library type by analyzing the source structure.
 * Isomorphic libraries have both browser/ and node/ entry points.
 *
 * @param projectRoot - Absolute path to the project root
 * @returns The detected library type
 */
export function detectLibraryType(projectRoot: string): LibraryType {
  const browserEntry = join(projectRoot, 'src', 'browser', 'index.ts')
  const nodeEntry = join(projectRoot, 'src', 'node', 'index.ts')

  const hasBrowserEntry = existsSync(browserEntry)
  const hasNodeEntry = existsSync(nodeEntry)

  if (hasBrowserEntry && hasNodeEntry) {
    return 'isomorphic'
  }
  return 'standard'
}

/**
 * Checks if a project has an isomorphic structure.
 *
 * @param projectRelativePath - Project path relative to workspace root
 * @param workspaceRoot - Absolute path to workspace root
 * @returns True if the project has isomorphic structure
 */
export function isIsomorphicProject(projectRelativePath: string, workspaceRoot: string): boolean {
  const browserPath = joinPathFragments(projectRelativePath, 'src', 'browser', 'index.ts')
  const nodePath = joinPathFragments(projectRelativePath, 'src', 'node', 'index.ts')

  return existsSync(join(workspaceRoot, browserPath)) && existsSync(join(workspaceRoot, nodePath))
}

/**
 * Gets the entry points for an isomorphic library.
 *
 * @returns Array of entry point names
 */
export function getIsomorphicEntryPoints(): readonly ['browser', 'node'] {
  return ['browser', 'node'] as const
}
