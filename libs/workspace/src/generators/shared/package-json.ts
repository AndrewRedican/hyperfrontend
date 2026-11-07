/**
 * What a generator reads from a project's `package.json`: its name, description and keywords.
 *
 * @module generators/shared/package-json
 */

import type { Tree } from './tree'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { joinPathFragments } from './paths'

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
 *
 * @example A project with and without a manifest
 * ```typescript
 * readPackageJsonInfo(tree, 'libs/core') // => { name: '@acme/core', description: 'Core library.', keywords: ['core', 'acme'] }
 * readPackageJsonInfo(tree, 'apps/docs') // => { name: null, description: '', keywords: [] } when apps/docs has no package.json
 * ```
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
 *
 * @example Telling a package from a bare project
 * ```typescript
 * getPackageNameFromProject(tree, 'libs/core') // => '@acme/core'
 * getPackageNameFromProject(tree, 'apps/docs') // => null
 * ```
 */
export function getPackageNameFromProject(tree: Tree, projectRoot: string): string | null {
  return readPackageJsonInfo(tree, projectRoot).name
}

/** Where a repository's packages are kept, as the root manifest states it. */
export interface Repository {
  /** The kind of repository, such as `git` */
  type?: string
  /** Its URL */
  url?: string
  /** The directory of one package within it */
  directory?: string
}

/** Where sponsorship of a package goes. */
export interface Funding {
  /** The platform */
  type?: string
  /** The page */
  url?: string
}

/** The root `package.json` as far as the generators read it: what every package of the workspace inherits from it. */
export interface RootManifest {
  /** The workspace's own name, whose scope its packages take */
  name?: string
  /** The licence its packages are under */
  license?: string
  /** The repository its packages are kept in */
  repository?: Repository | string
  /** Where sponsorship goes */
  funding?: Funding | string
  /** The engines its packages run on */
  engines?: Record<string, string>
}

/**
 * The root `package.json` of the tree, or nothing when the tree has none.
 *
 * @param tree - The tree whose root is looked at
 * @returns The manifest's fields the generators inherit from
 *
 * @example What a new package inherits
 * ```typescript
 * import { readRootManifest, scopeOf } from '@hyperfrontend/workspace/generators'
 *
 * const root = readRootManifest(tree)
 * // => { name: '@acme/workspace', license: 'MIT', repository: { type: 'git', url: 'https://github.com/acme/workspace.git' } }
 * scopeOf(root.name ?? '') // => '@acme'
 * ```
 */
export function readRootManifest(tree: Tree): RootManifest {
  const content = tree.read('package.json', 'utf-8')
  return content === null ? {} : (parse(content) as RootManifest)
}
