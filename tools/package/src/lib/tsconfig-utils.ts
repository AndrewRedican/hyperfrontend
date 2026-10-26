import type { Tree } from './tree/tree'
import { posix } from 'node:path'
import { entries, keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { updateJson } from './tree/tree'

/**
 * Compiler options as far as the path mappings go.
 */
interface PathsCompilerOptions {
  /** The path aliases, by specifier */
  paths?: Record<string, string[]>
}

/**
 * The base tsconfig as far as its path mappings go.
 */
interface PathsTsConfig {
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

/**
 * Sort paths object alphabetically by key.
 *
 * @param paths - The paths object to sort
 * @returns Sorted paths object
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
 */
export function addTsConfigPath(tree: Tree, options: AddPathOptions): void {
  updateJson<PathsTsConfig>(tree, 'tsconfig.base.json', (json) => {
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
 * Rename path mappings in tsconfig.base.json.
 * Handles both exact matches and prefixed paths (e.g., `@pkg/sub`).
 * Maintains alphabetical sorting.
 *
 * @param tree - The virtual file system tree
 * @param options - Options with current and new package names
 */
export function renameTsConfigPaths(tree: Tree, options: RenamePathOptions): void {
  updateJson<PathsTsConfig>(tree, 'tsconfig.base.json', (json) => {
    const paths = json.compilerOptions?.paths ?? {}
    const updatedPaths: Record<string, string[]> = {}

    for (const [key, value] of entries(paths)) {
      if (key === options.currentPackageName) {
        updatedPaths[options.newPackageName] = value
      } else if (key.startsWith(`${options.currentPackageName}/`)) {
        const suffix = key.slice(options.currentPackageName.length)
        updatedPaths[`${options.newPackageName}${suffix}`] = value
      } else {
        updatedPaths[key] = value
      }
    }

    json.compilerOptions = {
      ...json.compilerOptions,
      paths: sortPaths(updatedPaths),
    }

    return json
  })
}

/**
 * Update path mappings for a moved project in tsconfig.base.json.
 * Updates both the key (package name) and value (file path).
 * Maintains alphabetical sorting.
 *
 * @param tree - The virtual file system tree
 * @param options - Options with current/new roots and package names
 */
export function moveTsConfigPaths(tree: Tree, options: MovePathOptions): void {
  updateJson<PathsTsConfig>(tree, 'tsconfig.base.json', (json) => {
    const paths = json.compilerOptions?.paths ?? {}
    const updatedPaths: Record<string, string[]> = {}

    for (const [key, valuePaths] of entries(paths)) {
      const isOldPath = valuePaths.some((p) => p.startsWith(options.currentProjectRoot))

      if (isOldPath) {
        const updatedValuePaths = valuePaths.map((p) => p.replace(options.currentProjectRoot, options.newProjectRoot))

        let newKey = key
        if (options.updateName && key === options.currentPackageName) {
          newKey = options.newPackageName
        } else if (options.updateName && key.startsWith(`${options.currentPackageName}/`)) {
          const suffix = key.slice(options.currentPackageName.length)
          newKey = `${options.newPackageName}${suffix}`
        }

        updatedPaths[newKey] = updatedValuePaths
      } else {
        updatedPaths[key] = valuePaths
      }
    }

    json.compilerOptions = {
      ...json.compilerOptions,
      paths: sortPaths(updatedPaths),
    }

    return json
  })
}
