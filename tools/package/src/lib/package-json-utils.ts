import type { Tree } from '@nx/devkit'
import { joinPathFragments } from '@nx/devkit'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

/**
 * Result of reading package.json metadata.
 */
export interface PackageJsonInfo {
  /** Package name or null if not found */
  name: string | null
  /** Package description or empty string */
  description: string
}

/**
 * Read package name and description from a project's package.json.
 *
 * @param tree - The virtual file system tree
 * @param projectRoot - The project root path
 * @returns Package name and description
 */
export function readPackageJsonInfo(tree: Tree, projectRoot: string): PackageJsonInfo {
  const packageJsonPath = joinPathFragments(projectRoot, 'package.json')

  if (!tree.exists(packageJsonPath)) {
    return { name: null, description: '' }
  }

  const content = tree.read(packageJsonPath, 'utf-8')
  if (!content) {
    return { name: null, description: '' }
  }

  const packageJson = parse(content)
  return {
    name: packageJson.name || null,
    description: packageJson.description || '',
  }
}

/**
 * Get package name from a project's package.json file.
 *
 * @param tree - The virtual file system tree
 * @param projectRoot - The project root path
 * @returns The package name or null if not found
 */
export function getPackageNameFromProject(tree: Tree, projectRoot: string): string | null {
  return readPackageJsonInfo(tree, projectRoot).name
}
