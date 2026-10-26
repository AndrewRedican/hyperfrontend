import type { Tree } from './tree/tree'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { joinPathFragments } from './tree/paths'

/**
 * Result of reading package.json metadata.
 */
export interface PackageJsonInfo {
  /** Package name or null if not found */
  name: string | null
  /** Package description or empty string */
  description: string
  /** npm keywords, empty when the package declares none */
  keywords: string[]
}

/**
 * Read package name, description and keywords from a project's package.json.
 *
 * @param tree - The virtual file system tree
 * @param projectRoot - The project root path
 * @returns Package name and description
 */
export function readPackageJsonInfo(tree: Tree, projectRoot: string): PackageJsonInfo {
  const packageJsonPath = joinPathFragments(projectRoot, 'package.json')

  if (!tree.exists(packageJsonPath)) {
    return { name: null, description: '', keywords: [] }
  }

  const content = tree.read(packageJsonPath, 'utf-8')
  if (!content) {
    return { name: null, description: '', keywords: [] }
  }

  const packageJson = parse(content)
  return {
    name: packageJson.name || null,
    description: packageJson.description || '',
    keywords: isArray(packageJson.keywords) ? packageJson.keywords.filter((keyword: unknown) => typeof keyword === 'string') : [],
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
