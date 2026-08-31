import type { Tree } from '@hyperfrontend/project-scope/vfs'
import { join, dirname, relative } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { exists } from '@hyperfrontend/project-scope/core/fs'
import { findFiles } from '@hyperfrontend/project-scope/project/traversal'

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
  /** Absolute path to the package directory */
  path: string
  /** Package name from package.json */
  name: string
}

/**
 * Finds changelog files for a list of packages.
 * Returns a map of project path to changelog absolute path.
 *
 * @param workspaceRoot - Workspace root path
 * @param packages - List of packages to find changelogs for
 * @returns Map of project path to changelog path
 *
 * @example Find changelog files for all packages
 * ```typescript
 * import { findChangelogs, discoverPackages } from '@hyperfrontend/versioning'
 *
 * const { packages } = discoverPackages()
 * const changelogs = findChangelogs('/workspace', packages)
 *
 * for (const [projectPath, changelogPath] of changelogs) {
 *   console.log(`${projectPath} -> ${changelogPath}`)
 * }
 * ```
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
 * @example Find the changelog for a single project
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
 * Finds changelog files for a list of packages using VFS tree.
 * Returns a map of project path to changelog absolute path.
 *
 * @param tree - VFS tree instance
 * @param packages - List of packages to find changelogs for
 * @returns Map of project path to changelog path
 *
 * @example Find changelogs using VFS tree
 * ```typescript
 * import { findChangelogsInTree, discoverPackages } from '@hyperfrontend/versioning'
 *
 * // Inside an Nx generator
 * export default function myGenerator(tree: Tree) {
 *   const { packages } = discoverPackages()
 *   const changelogs = findChangelogsInTree(tree, packages)
 *
 *   for (const [projectPath, changelogPath] of changelogs) {
 *     console.log(`Found changelog at ${changelogPath}`)
 *   }
 * }
 * ```
 */
export function findChangelogsInTree(tree: Tree, packages: readonly PackageInfo[]): Map<string, string> {
  const result = createMap<string, string>()

  for (const pkg of packages) {
    const changelogPath = findProjectChangelogInTree(tree, pkg.path)
    if (changelogPath) {
      result.set(pkg.path, changelogPath)
    }
  }

  return result
}

/**
 * Finds the changelog file for a single project using VFS tree.
 * Checks for common changelog names in order of priority.
 *
 * @param tree - VFS tree instance
 * @param projectPath - Path to project directory
 * @returns Absolute path to changelog or null if not found
 *
 * @example Find project changelog using VFS tree
 * ```typescript
 * import { findProjectChangelogInTree } from '@hyperfrontend/versioning'
 *
 * // Inside an Nx generator
 * export default function myGenerator(tree: Tree) {
 *   const changelogPath = findProjectChangelogInTree(tree, 'libs/my-lib')
 *   if (changelogPath) {
 *     const content = tree.read(changelogPath, 'utf-8')
 *     // Process changelog content
 *   }
 * }
 * ```
 */
export function findProjectChangelogInTree(tree: Tree, projectPath: string): string | null {
  const relativePath = projectPath.startsWith(tree.root) ? relative(tree.root, projectPath) : projectPath

  for (const name of CHANGELOG_NAMES) {
    const changelogRelativePath = relativePath ? `${relativePath}/${name}` : name
    const changelogAbsPath = join(projectPath, name)
    if (tree.isFile(changelogRelativePath)) {
      return changelogAbsPath
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
 * @example Discover all changelog files within a workspace
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
