/**
 * Workspace and project root detection utilities.
 *
 * Re-exports from `@hyperfrontend/project-scope` with additional
 * eslint-rules-specific utilities.
 *
 * @module utils/workspace
 */

import { findUpwardWhere } from '@hyperfrontend/project-scope/core/fs'
import {
  findProjectRoot as projectScopeFindProjectRoot,
  findRootDirectory,
  findWorkspaceRoot as projectScopeFindWorkspaceRoot,
} from '@hyperfrontend/project-scope/project/root'
import { createRuleLogger } from './logger'

const logger = createRuleLogger('workspace')

/**
 * Re-export findProjectRoot from project-scope.
 * Finds the nearest directory containing package.json with source files
 * or project.json.
 *
 * @param startPath - Starting path for search
 * @returns Project root path or null
 */
export const findProjectRoot = projectScopeFindProjectRoot

/**
 * Re-export findWorkspaceRoot from project-scope.
 * Finds workspace/monorepo root by looking for workspace markers
 * (nx.json, turbo.json, etc.) or package.json with workspaces field.
 *
 * @param startPath - Starting path for search
 * @returns Workspace root path or null
 */
export const findWorkspaceRoot = projectScopeFindWorkspaceRoot

/**
 * Find workspace root by looking for a specific marker file.
 * Use this when you need to find a root with a specific file
 * (e.g., tsconfig.base.json).
 *
 * @param startPath - Starting path for search
 * @param markerFile - File name to search for (e.g., 'tsconfig.base.json')
 * @returns Root directory path or null
 *
 * @example
 * ```typescript
 * // Find root with tsconfig.base.json
 * const root = findWorkspaceRootByMarker('/path/to/file', 'tsconfig.base.json')
 * ```
 */
export function findWorkspaceRootByMarker(startPath: string, markerFile: string): string | null {
  logger.debug('Finding workspace root by marker', { startPath, marker: markerFile })

  const result = findRootDirectory(startPath, [markerFile])

  if (result) {
    logger.debug('Found workspace root', { root: result })
  } else {
    logger.debug('Workspace root not found')
  }

  return result
}

/**
 * Find workspace root specifically for TypeScript projects.
 * Searches for tsconfig.base.json.
 *
 * @param startPath - Starting path for search
 * @returns Root directory containing tsconfig.base.json or null
 */
export function findTypeScriptWorkspaceRoot(startPath: string): string | null {
  return findWorkspaceRootByMarker(startPath, 'tsconfig.base.json')
}

/**
 * Find workspace root specifically for Nx projects.
 * Searches for nx.json.
 *
 * @param startPath - Starting path for search
 * @returns Root directory containing nx.json or null
 */
export function findNxWorkspaceRoot(startPath: string): string | null {
  return findWorkspaceRootByMarker(startPath, 'nx.json')
}

/**
 * Check if a path is within a workspace.
 *
 * @param targetPath - Path to check
 * @param workspaceRoot - Workspace root path
 * @returns True if targetPath is within workspaceRoot
 */
export function isWithinWorkspace(targetPath: string, workspaceRoot: string): boolean {
  const normalizedTarget = targetPath.split('/').join('/')
  const normalizedRoot = workspaceRoot.split('/').join('/')

  return normalizedTarget.startsWith(normalizedRoot)
}

/**
 * Re-export findRootDirectory for advanced usage.
 */
export { findRootDirectory }

/**
 * Re-export findUpwardWhere for custom upward searches.
 */
export { findUpwardWhere }
