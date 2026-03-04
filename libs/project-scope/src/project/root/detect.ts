import { join } from 'node:path'
import { exists, locateByMarkers, findUpwardWhere } from '../../core/fs'
import { createScopedLogger } from '../../core/logger'
import { findNearestPackageJson, readPackageJsonIfExists } from '../package'

const rootLogger = createScopedLogger('project-scope:root')

/**
 * Files indicating project root.
 */
export const ROOT_MARKERS = <const>['package.json', '.git']

/**
 * Files indicating workspace/monorepo root.
 */
export const WORKSPACE_MARKERS = <const>['nx.json', 'turbo.json', 'lerna.json', 'pnpm-workspace.yaml', 'rush.json']

/**
 * Check if directory looks like a project directory.
 *
 * @param dirPath - Directory path to check
 * @returns True if directory appears to be a project
 */
function looksLikeProjectDir(dirPath: string): boolean {
  if (exists(join(dirPath, 'src'))) {
    return true
  }

  const entryPoints = ['index.ts', 'index.js', 'index.tsx', 'index.jsx', 'main.ts', 'main.js']
  for (const entry of entryPoints) {
    if (exists(join(dirPath, entry))) {
      return true
    }
  }

  if (exists(join(dirPath, 'project.json'))) {
    return true
  }

  return false
}

/**
 * Find the project root from a starting path.
 * Project root is the nearest directory containing package.json
 * with source files.
 *
 * @param startPath - Starting path
 * @returns Project root path or null
 *
 * @example
 * ```typescript
 * import { findProjectRoot } from '@hyperfrontend/project-scope'
 *
 * // Find project root from current directory
 * const root = findProjectRoot(process.cwd())
 * if (root) {
 *   console.log('Project root:', root)
 * }
 *
 * // Find root from a deeply nested file
 * const root2 = findProjectRoot('./libs/my-lib/src/utils/helper.ts')
 * ```
 */
export function findProjectRoot(startPath: string): string | null {
  rootLogger.debug('Finding project root', { startPath })

  const result = findUpwardWhere(startPath, (dir) => {
    if (exists(join(dir, 'package.json')) && looksLikeProjectDir(dir)) {
      return true
    }
    if (exists(join(dir, 'project.json'))) {
      return true
    }
    return false
  })

  if (result) {
    rootLogger.debug('Found project root', { root: result })
  } else {
    rootLogger.debug('Project root not found')
  }

  return result
}

/**
 * Find workspace root (monorepo root).
 * Searches up for workspace markers like nx.json, turbo.json, etc.
 *
 * @param startPath - Starting path
 * @returns Workspace root path or null
 *
 * @example
 * ```typescript
 * import { findWorkspaceRoot } from '@hyperfrontend/project-scope'
 *
 * const root = findWorkspaceRoot('./libs/my-lib')
 * if (root) {
 *   console.log('Monorepo root:', root) // e.g., '/home/user/my-monorepo'
 * }
 * ```
 */
export function findWorkspaceRoot(startPath: string): string | null {
  rootLogger.debug('Finding workspace root', { startPath })

  const byMarker = locateByMarkers(startPath, WORKSPACE_MARKERS)
  if (byMarker) {
    rootLogger.debug('Found workspace root by marker', { root: byMarker })
    return byMarker
  }

  const byWorkspaces = findUpwardWhere(startPath, (dir) => {
    const pkg = readPackageJsonIfExists(dir)
    return pkg?.workspaces !== undefined
  })
  if (byWorkspaces) {
    rootLogger.debug('Found workspace root by workspaces field', { root: byWorkspaces })
    return byWorkspaces
  }

  const byPackage = findNearestPackageJson(startPath)
  if (byPackage) {
    rootLogger.debug('Found workspace root by package.json', { root: byPackage })
  } else {
    rootLogger.debug('Workspace root not found')
  }

  return byPackage
}

/**
 * Generic root finder - walk up looking for any marker file.
 *
 * @param startPath - Starting path
 * @param markers - Files to search for
 * @returns Root directory path or null
 */
export function findRootDirectory(startPath: string, markers: readonly string[] | string[]): string | null {
  return locateByMarkers(startPath, markers)
}

/**
 * Find nearest .git directory (repo root).
 *
 * @param startPath - Starting path
 * @returns Git root path or null
 */
export function findGitRoot(startPath: string): string | null {
  return locateByMarkers(startPath, ['.git'])
}
