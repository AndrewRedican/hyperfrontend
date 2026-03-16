/**
 * Changelog Discovery
 *
 * Discovers CHANGELOG.md files within workspace projects.
 */

import { join, dirname } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
// eslint-disable-next-line @nx/enforce-module-boundaries
import { exists, findFiles } from '@hyperfrontend/project-scope'

/**
 * Common changelog file names in priority order.
 */
export const CHANGELOG_NAMES: readonly string[] = ['CHANGELOG.md', 'Changelog.md', 'changelog.md', 'HISTORY.md', 'CHANGES.md']

/**
 * Represents a discovered changelog file.
 */
export interface DiscoveredChangelog {
  /** Absolute path to the changelog file */
  readonly path: string

  /** Relative path from project root */
  readonly relativePath: string

  /** Path to the project containing this changelog */
  readonly projectPath: string

  /** Name of the changelog file */
  readonly filename: string
}

/**
 * Package info for changelog lookup.
 */
interface PackageInfo {
  path: string
  name: string
}

/**
 * Finds changelog files for a list of packages.
 * Returns a map of project path to changelog absolute path.
 *
 * @param workspaceRoot - Workspace root path
 * @param packages - List of packages to find changelogs for
 * @returns Map of project path to changelog path
 */
export function findChangelogs(workspaceRoot: string, packages: readonly PackageInfo[]): Map<string, string> {
  const result = createMap<string, string>()

  for (const pkg of packages) {
    const changelogPath = findProjectChangelog(pkg.path)
    if (changelogPath) {
      result.set(pkg.path, changelogPath)
    }
  }

  return result
}

/**
 * Finds the changelog file for a single project.
 * Checks for common changelog names in order of priority.
 *
 * @param projectPath - Path to project directory
 * @returns Absolute path to changelog or null if not found
 *
 * @example
 * ```typescript
 * import { findProjectChangelog } from '@hyperfrontend/versioning'
 *
 * const changelogPath = findProjectChangelog('./libs/my-lib')
 * if (changelogPath) {
 *   console.log('Found changelog:', changelogPath)
 * }
 * ```
 */
export function findProjectChangelog(projectPath: string): string | null {
  for (const name of CHANGELOG_NAMES) {
    const changelogPath = join(projectPath, name)
    if (exists(changelogPath)) {
      return changelogPath
    }
  }
  return null
}

/**
 * Discovers all changelog files within a workspace.
 *
 * @param workspaceRoot - Workspace root path
 * @param patterns - Glob patterns for finding changelogs (default: all CHANGELOGs)
 * @returns Array of discovered changelog information
 *
 * @example
 * ```typescript
 * import { discoverAllChangelogs } from '@hyperfrontend/versioning'
 *
 * const changelogs = discoverAllChangelogs('/path/to/workspace')
 * for (const changelog of changelogs) {
 *   console.log(`${changelog.projectPath} -> ${changelog.path}`)
 * }
 * ```
 */
export function discoverAllChangelogs(
  workspaceRoot: string,
  patterns: readonly string[] = ['**/CHANGELOG.md', '**/Changelog.md', '**/changelog.md']
): readonly DiscoveredChangelog[] {
  const results: DiscoveredChangelog[] = []

  const files = findFiles(workspaceRoot, [...patterns], {
    ignorePatterns: ['**/node_modules/**', '**/dist/**'],
    absolutePaths: false,
  })

  for (const relativePath of files) {
    const absolutePath = join(workspaceRoot, relativePath)
    const projectPath = dirname(absolutePath)
    const filename = relativePath.split('/').pop() ?? 'CHANGELOG.md'

    results.push({
      path: absolutePath,
      relativePath,
      projectPath,
      filename,
    })
  }

  return results
}
