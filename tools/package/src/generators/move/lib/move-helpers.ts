import type { Tree } from '@nx/devkit'
import type { MoveGeneratorSchema } from '../schema'
import { joinPathFragments, names, offsetFromRoot, readProjectConfiguration, updateJson, visitNotIgnoredFiles } from '@nx/devkit'
import { updateContentReferences as updateContentRefsShared } from '../../../lib/content-updaters'
import { replaceDescriptionPackageName } from '../../../lib/json-updaters'
import { derivePackageName, deriveProjectNameFromPath, getDirectoryName } from '../../../lib/naming-utils'
import { getPackageNameFromProject } from '../../../lib/package-json-utils'
import { updateProjectReferences as updateProjectRefsShared } from '../../../lib/project-references'
import { moveTsConfigPaths } from '../../../lib/tsconfig-utils'

/** Normalized options for move generator. */
export interface NormalizedOptions {
  /**
   *
   */
  projectName: string
  /**
   *
   */
  currentProjectRoot: string
  /**
   *
   */
  newProjectRoot: string
  /**
   *
   */
  newProjectName: string
  /**
   *
   */
  currentPackageName: string
  /**
   *
   */
  newPackageName: string
  /**
   *
   */
  updateName: boolean
  /**
   *
   */
  skipFormat: boolean
  /**
   *
   */
  newOffsetFromRoot: string
  /**
   *
   */
  projectDirName: string
  /**
   *
   */
  newGlobalName: string
}

/**
 * Normalize user-provided options into a consistent format.
 *
 * @param tree - The virtual file system tree
 * @param options - User-provided generator options
 * @returns Normalized options object
 */
export function normalizeOptions(tree: Tree, options: MoveGeneratorSchema): NormalizedOptions {
  const projectConfig = readProjectConfiguration(tree, options.project)
  const currentProjectRoot = projectConfig.root
  const projectName = options.project

  const projectDirName = options.newName ? names(options.newName).fileName : getDirectoryName(currentProjectRoot)

  const newProjectRoot = joinPathFragments(options.destination, projectDirName)

  const updateName = options.updateName ?? true

  let newProjectName: string
  let newPackageName: string

  if (updateName) {
    newProjectName = deriveProjectNameFromPath(newProjectRoot)
    newPackageName = derivePackageName(newProjectName)
  } else {
    newProjectName = projectName
    newPackageName = getPackageNameFromProject(tree, currentProjectRoot) || derivePackageName(projectName)
  }

  const currentPackageName = getPackageNameFromProject(tree, currentProjectRoot) || derivePackageName(projectName)

  const newLibName = newPackageName.replace('@hyperfrontend/', '')
  const newGlobalName = `Hyperfrontend${names(newLibName).className}`

  return {
    projectName,
    currentProjectRoot,
    newProjectRoot,
    newProjectName,
    currentPackageName,
    newPackageName,
    updateName,
    skipFormat: options.skipFormat ?? false,
    newOffsetFromRoot: offsetFromRoot(newProjectRoot),
    projectDirName,
    newGlobalName,
  }
}

/**
 * Copy files from source to destination directory.
 *
 * @param tree - The virtual file system tree
 * @param source - The source directory path to copy from
 * @param destination - The destination directory path to copy to
 */
export function copyDirectory(tree: Tree, source: string, destination: string): void {
  visitNotIgnoredFiles(tree, source, (filePath) => {
    const relativePath = filePath.replace(source, '')
    const newPath = joinPathFragments(destination, relativePath)
    const content = tree.read(filePath)
    if (content) {
      tree.write(newPath, content)
    }
  })
}

/**
 * Delete all files in a directory recursively.
 *
 * @param tree - The virtual file system tree
 * @param directory - The directory path to delete
 */
export function deleteDirectory(tree: Tree, directory: string): void {
  visitNotIgnoredFiles(tree, directory, (filePath) => {
    tree.delete(filePath)
  })
}

/**
 * Update project.json file in the new location with updated paths and name.
 *
 * @param tree - The virtual file system tree
 * @param options - Normalized move generator options
 */
export function updateProjectJson(tree: Tree, options: NormalizedOptions): void {
  const projectJsonPath = joinPathFragments(options.newProjectRoot, 'project.json')

  updateJson(tree, projectJsonPath, (json) => {
    json.$schema = `${options.newOffsetFromRoot}node_modules/nx/schemas/project-schema.json`

    if (options.updateName) {
      json.name = options.newProjectName
      replaceDescriptionPackageName(json, options.currentPackageName, options.newPackageName)

      const buildOptions = json.targets?.build?.options
      if (buildOptions) {
        if (buildOptions.iife) {
          buildOptions.iife.globalName = options.newGlobalName
        }
        if (buildOptions.umd) {
          buildOptions.umd.globalName = options.newGlobalName
        }
      }
    }

    return json
  })
}

/**
 * Update package.json file in the new location with new package name.
 *
 * @param tree - The virtual file system tree
 * @param options - Normalized move generator options
 */
export function updatePackageJson(tree: Tree, options: NormalizedOptions): void {
  const packageJsonPath = joinPathFragments(options.newProjectRoot, 'package.json')

  if (!tree.exists(packageJsonPath)) {
    return
  }

  updateJson(tree, packageJsonPath, (json) => {
    if (options.updateName) {
      json.name = options.newPackageName
      replaceDescriptionPackageName(json, options.currentPackageName, options.newPackageName)
    }

    return json
  })
}

export { updateEslintConfig, updateTsConfigJson, updateTsConfigLibJson, updateTsConfigSpecJson } from './config-updaters'

/**
 * Update TypeScript path mappings in tsconfig.base.json.
 *
 * @param tree - The virtual file system tree
 * @param options - Normalized move generator options
 */
export function updateTsConfigPaths(tree: Tree, options: NormalizedOptions): void {
  moveTsConfigPaths(tree, {
    currentProjectRoot: options.currentProjectRoot,
    newProjectRoot: options.newProjectRoot,
    currentPackageName: options.currentPackageName,
    newPackageName: options.newPackageName,
    updateName: options.updateName,
  })
}

/**
 * Update project references in other projects that depend on the moved project.
 *
 * @param tree - The virtual file system tree
 * @param options - Normalized move generator options
 */
export function updateProjectReferences(tree: Tree, options: NormalizedOptions): void {
  if (!options.updateName || options.projectName === options.newProjectName) {
    return
  }

  updateProjectRefsShared(tree, {
    currentProjectName: options.projectName,
    newProjectName: options.newProjectName,
    excludeRoots: [options.currentProjectRoot, options.newProjectRoot],
  })
}

/**
 * Update README and source file references with new package name.
 *
 * @param tree - The virtual file system tree
 * @param options - Normalized move generator options
 */
export function updateContentReferences(tree: Tree, options: NormalizedOptions): void {
  if (!options.updateName || options.currentPackageName === options.newPackageName) {
    return
  }

  updateContentRefsShared(tree, {
    projectRoot: options.newProjectRoot,
    currentPackageName: options.currentPackageName,
    newPackageName: options.newPackageName,
  })
}
