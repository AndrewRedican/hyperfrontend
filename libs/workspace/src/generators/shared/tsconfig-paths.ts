/**
 * The path aliases of the workspace's base tsconfig: adding a project's, and renaming or moving them
 * when the project is.
 *
 * @module generators/shared/tsconfig-paths
 */

import type { Tree } from './tree'
import { posix } from 'node:path'
import { entries, keys, values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { amendJson, readJson, updateJson } from './tree'

/**
 * Compiler options as far as the path mappings go.
 */
export interface PathsCompilerOptions {
  /** The path aliases, by specifier */
  paths?: Record<string, string[]>
}

/**
 * The base tsconfig as far as its path mappings go.
 */
export interface PathsTsConfig {
  /** The compiler options */
  compilerOptions?: PathsCompilerOptions
}

/**
 * Options for adding a new path mapping.
 */
export interface AddPathOptions {
  /** npm package name (e.g., '@hyperfrontend/data-utils') */
  packageName: string
  /** Project root path (e.g., 'libs/utils/data') */
  projectRoot: string
}

/**
 * Options for renaming path mappings.
 */
export interface RenamePathOptions {
  /** Current npm package name */
  currentPackageName: string
  /** New npm package name */
  newPackageName: string
}

/**
 * Options for moving path mappings.
 */
export interface MovePathOptions {
  /** Current project root path */
  currentProjectRoot: string
  /** New project root path */
  newProjectRoot: string
  /** Current npm package name */
  currentPackageName: string
  /** New npm package name */
  newPackageName: string
  /** Whether the name is being updated */
  updateName: boolean
}

/** The file that holds the workspace's path aliases. */
export const BASE_TSCONFIG = 'tsconfig.base.json'

/** The lead of an alias path written from the current directory; a tsconfig separates with a forward slash on every platform. */
const FROM_HERE = `.${posix.sep}`

/**
 * Sort paths object alphabetically by key.
 *
 * @param paths - The paths object to sort
 * @returns Sorted paths object
 *
 * @example A stable order for the alias map
 * ```typescript
 * sortPaths({ '@acme/utils': ['libs/utils/src/index.ts'], '@acme/core': ['libs/core/src/index.ts'] })
 * // => { '@acme/core': ['libs/core/src/index.ts'], '@acme/utils': ['libs/utils/src/index.ts'] }
 * ```
 */
export function sortPaths(paths: Record<string, string[]>): Record<string, string[]> {
  const sortedPaths: Record<string, string[]> = {}
  for (const key of keys(paths).sort()) {
    const pathValue = paths[key]
    if (pathValue) {
      sortedPaths[key] = pathValue
    }
  }
  return sortedPaths
}

/**
 * Add a new path mapping to tsconfig.base.json.
 * Maintains alphabetical sorting.
 *
 * @param tree - The virtual file system tree
 * @param options - Options containing package name and project root
 *
 * @example Registering a new library's alias
 * ```typescript
 * import { addTsConfigPath } from '@hyperfrontend/workspace/generators'
 *
 * addTsConfigPath(tree, { packageName: '@acme/data-utils', projectRoot: 'libs/utils/data' })
 * // tsconfig.base.json compilerOptions.paths gains '@acme/data-utils': ['libs/utils/data/src/index.ts'], keys sorted
 * ```
 */
export function addTsConfigPath(tree: Tree, options: AddPathOptions): void {
  updateJson<PathsTsConfig>(tree, BASE_TSCONFIG, (json) => {
    const paths = json.compilerOptions?.paths ?? {}

    paths[options.packageName] = [posix.join(options.projectRoot, 'src', 'index.ts')]

    json.compilerOptions = {
      ...json.compilerOptions,
      paths: sortPaths(paths),
    }

    return json
  })
}

/**
 * Whether an alias is a package's: its name, or one of its entries.
 *
 * @param key - The alias, as the base tsconfig names it
 * @param packageName - What the package is imported by, such as `@acme/core`
 * @returns Whether the alias is the package's name or its name and a subpath
 */
function isAliasOf(key: string, packageName: string): boolean {
  // why: a sibling such as @acme/core-ui starts with @acme/core without being an entry of it, so the name must end at a slash
  return key === packageName || key.startsWith(`${packageName}/`)
}

/**
 * The aliases the base tsconfig holds under a package's name: the name itself and each of its
 * entries, whichever project they resolve to.
 *
 * @param tree - The tree whose base tsconfig is read
 * @param packageName - What the package is imported by, such as `@acme/core`
 * @returns The aliases in the order they are written, none where the tree has no base tsconfig
 *
 * @example Whether a name a package is about to take is already imported from somewhere
 * ```typescript
 * aliasesOf(tree, '@acme/core') // => ['@acme/core', '@acme/core/testing'], and never '@acme/core-ui'
 * aliasesOf(tree, '@acme/fresh') // => []
 * ```
 */
export function aliasesOf(tree: Tree, packageName: string): string[] {
  if (!tree.exists(BASE_TSCONFIG)) return []
  return keys(readJson<PathsTsConfig>(tree, BASE_TSCONFIG).compilerOptions?.paths ?? {}).filter((key) => isAliasOf(key, packageName))
}

/**
 * The alias a renamed package's alias becomes: the new name with the subpath kept.
 *
 * @param key - The alias, as the base tsconfig names it
 * @param currentPackageName - What the package is imported by before the rename
 * @param newPackageName - What it is imported by after
 * @returns The alias under the new name, or the alias as it is when it is not the package's
 */
function aliasAfter(key: string, currentPackageName: string, newPackageName: string): string {
  return isAliasOf(key, currentPackageName) ? `${newPackageName}${key.slice(currentPackageName.length)}` : key
}

/**
 * Rename path mappings in tsconfig.base.json.
 * Handles both exact matches and prefixed paths (e.g., `@pkg/sub`).
 * Maintains alphabetical sorting.
 *
 * @param tree - The virtual file system tree
 * @param options - Options with current and new package names
 *
 * @example The entry points of a package are renamed with it
 * ```typescript
 * renameTsConfigPaths(tree, { currentPackageName: '@acme/core', newPackageName: '@acme/kernel' })
 * // '@acme/core' and '@acme/core/testing' became '@acme/kernel' and '@acme/kernel/testing'; '@acme/core-ui' is untouched
 * ```
 */
export function renameTsConfigPaths(tree: Tree, options: RenamePathOptions): void {
  amendJson<PathsTsConfig>(tree, BASE_TSCONFIG, (json) => {
    const paths = json.compilerOptions?.paths ?? {}
    // why: a workspace that holds no alias of the package has nothing to rename, and the aliases it holds keep the order they are written in
    if (!keys(paths).some((key) => isAliasOf(key, options.currentPackageName))) return json
    const updatedPaths: Record<string, string[]> = {}
    for (const [key, value] of entries(paths)) updatedPaths[aliasAfter(key, options.currentPackageName, options.newPackageName)] = value
    json.compilerOptions = { ...json.compilerOptions, paths: sortPaths(updatedPaths) }
    return json
  })
}

/**
 * An alias path as the workspace root sees it: without the lead that writes it from the current
 * directory, which names the same path.
 *
 * @param path - The alias path, as the base tsconfig writes it
 * @returns The path without that lead
 */
function fromRoot(path: string): string {
  return path.startsWith(FROM_HERE) ? path.slice(FROM_HERE.length) : path
}

/**
 * Whether an alias path is a project's root or lies under it.
 *
 * @param path - The alias path, as the base tsconfig writes it
 * @param root - The project's root
 * @returns Whether the project holds the path
 */
function liesUnder(path: string, root: string): boolean {
  const bare = fromRoot(path)
  // why: a sibling such as libs/core-ui starts with libs/core without lying under it, so the root must end at a separator.
  return bare === root || bare.startsWith(`${root}${posix.sep}`)
}

/**
 * Where an alias path points once a project has moved: under the new root when it is the project's
 * root or lies under it, and where it was otherwise.
 *
 * @param path - The alias path, as the base tsconfig writes it
 * @param currentRoot - The project's current root
 * @param newRoot - The project's new root
 * @returns The path under the new root, or the path as given when the project does not hold it
 */
function movedPath(path: string, currentRoot: string, newRoot: string): string {
  if (!liesUnder(path, currentRoot)) return path
  const bare = fromRoot(path)
  return `${path.slice(0, path.length - bare.length)}${newRoot}${bare.slice(currentRoot.length)}`
}

/**
 * Update path mappings for a moved project in tsconfig.base.json.
 * Updates both the key (package name) and value (file path) of the aliases that resolve to the
 * project's root or under it; a path elsewhere stays, a sibling directory whose name merely starts
 * with the project's included.
 * Maintains alphabetical sorting.
 *
 * @param tree - The virtual file system tree
 * @param options - Options with current/new roots and package names
 *
 * @example Moving the aliases with the directory, keeping the name
 * ```typescript
 * moveTsConfigPaths(tree, {
 *   currentProjectRoot: 'libs/core',
 *   newProjectRoot: 'packages/core',
 *   currentPackageName: '@acme/core',
 *   newPackageName: '@acme/core',
 *   updateName: false,
 * })
 * // '@acme/core': ['libs/core/src/index.ts'] became '@acme/core': ['packages/core/src/index.ts']
 * // '@acme/core-ui': ['libs/core-ui/src/index.ts'] is untouched: libs/core-ui is not under libs/core
 * ```
 */
export function moveTsConfigPaths(tree: Tree, options: MovePathOptions): void {
  amendJson<PathsTsConfig>(tree, BASE_TSCONFIG, (json) => {
    const paths = json.compilerOptions?.paths ?? {}
    // why: an alias is the project's by where it resolves, not by whether the move changes its paths, so a move that keeps the root still renames it
    const held = (valuePaths: readonly string[]): boolean => valuePaths.some((path) => liesUnder(path, options.currentProjectRoot))
    // why: a workspace that holds no alias under the project has nothing to move, and the aliases it holds keep the order they are written in
    if (!values(paths).some(held)) return json
    const updatedPaths: Record<string, string[]> = {}
    for (const [key, valuePaths] of entries(paths)) {
      if (held(valuePaths)) {
        const movedKey = options.updateName ? aliasAfter(key, options.currentPackageName, options.newPackageName) : key
        updatedPaths[movedKey] = valuePaths.map((path) => movedPath(path, options.currentProjectRoot, options.newProjectRoot))
      } else {
        updatedPaths[key] = valuePaths
      }
    }
    json.compilerOptions = { ...json.compilerOptions, paths: sortPaths(updatedPaths) }
    return json
  })
}
