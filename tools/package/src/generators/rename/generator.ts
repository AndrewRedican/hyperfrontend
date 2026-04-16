import type { Tree } from '@nx/devkit'
import type { RenameGeneratorSchema } from './schema'
import { formatFiles, readProjectConfiguration, updateJson, joinPathFragments } from '@nx/devkit'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { checkCIWorkflow } from '../../lib/ci-helpers'
import { updateContentReferences } from '../../lib/content-updaters'
import { checkE2EProject } from '../../lib/e2e-helpers'
import { replaceDescriptionPackageName } from '../../lib/json-updaters'
import { logger } from '../../lib/logger'
import { derivePackageName, deriveProjectName, extractProjectPrefix } from '../../lib/naming-utils'
import { updateProjectReferences } from '../../lib/project-references'
import { renameTsConfigPaths } from '../../lib/tsconfig-utils'

/**
 * Normalized options for rename generator.
 */
interface NormalizedOptions {
  /** Current project name */
  currentProjectName: string
  /** Current project root */
  currentProjectRoot: string
  /** New project name */
  newProjectName: string
  /** New package name (npm) */
  newPackageName: string
  /** Current package name (for updating references) */
  currentPackageName: string
  /** Skip formatting */
  skipFormat: boolean
}

/**
 * Normalize user-provided options.
 *
 * @param tree - Virtual file system tree
 * @param options - User provided options
 * @returns Normalized options
 */
function normalizeOptions(tree: Tree, options: RenameGeneratorSchema): NormalizedOptions {
  const projectConfig = readProjectConfiguration(tree, options.project)

  const currentProjectName = options.project
  const currentProjectRoot = projectConfig.root
  const currentPackageName = derivePackageName(currentProjectName)

  const prefix = extractProjectPrefix(currentProjectName)
  const newProjectName = deriveProjectName(options.newName, prefix)
  const newPackageName = derivePackageName(newProjectName)

  return {
    currentProjectName,
    currentProjectRoot,
    newProjectName,
    newPackageName,
    currentPackageName,
    skipFormat: options.skipFormat ?? false,
  }
}

/**
 * Update project.json with new project name.
 *
 * @param tree - Virtual file system tree
 * @param options - Normalized options
 */
function updateProjectJson(tree: Tree, options: NormalizedOptions): void {
  const projectJsonPath = joinPathFragments(options.currentProjectRoot, 'project.json')

  updateJson(tree, projectJsonPath, (json) => {
    json.name = options.newProjectName
    replaceDescriptionPackageName(json, options.currentPackageName, options.newPackageName)
    return json
  })
}

/**
 * Update package.json with new package name.
 *
 * @param tree - Virtual file system tree
 * @param options - Normalized options
 */
function updatePackageJson(tree: Tree, options: NormalizedOptions): void {
  const packageJsonPath = joinPathFragments(options.currentProjectRoot, 'package.json')

  if (!tree.exists(packageJsonPath)) {
    return
  }

  updateJson(tree, packageJsonPath, (json) => {
    json.name = options.newPackageName
    replaceDescriptionPackageName(json, options.currentPackageName, options.newPackageName)
    return json
  })
}

/**
 * Nx generator that renames a project and updates all references.
 *
 * This generator:
 * 1. Updates project.json with new name
 * 2. Updates package.json with new npm package name
 * 3. Updates tsconfig.base.json path mappings
 * 4. Updates references in other projects (implicit dependencies, target dependencies)
 * 5. Updates README.md references
 * 6. Updates `@module` JSDoc tags in source files
 *
 * Note: This generator does NOT rename the project folder. Use the move generator
 * to also relocate the project.
 *
 * @param tree - The Nx virtual file system tree
 * @param options - Configuration options
 * @returns A promise that resolves when the generator completes
 *
 * @example Rename a library
 * ```bash
 * nx generate @hyperfrontend/package:rename lib-my-utils new-utils
 * ```
 */
export async function renameGenerator(tree: Tree, options: RenameGeneratorSchema): Promise<void> {
  const normalizedOptions = normalizeOptions(tree, options)

  if (normalizedOptions.currentProjectName === normalizedOptions.newProjectName) {
    throw createError(`New name must be different from current name: ${normalizedOptions.currentProjectName}`)
  }

  updateProjectJson(tree, normalizedOptions)
  updatePackageJson(tree, normalizedOptions)

  renameTsConfigPaths(tree, {
    currentPackageName: normalizedOptions.currentPackageName,
    newPackageName: normalizedOptions.newPackageName,
  })

  updateProjectReferences(tree, {
    currentProjectName: normalizedOptions.currentProjectName,
    newProjectName: normalizedOptions.newProjectName,
  })

  updateContentReferences(tree, {
    projectRoot: normalizedOptions.currentProjectRoot,
    currentPackageName: normalizedOptions.currentPackageName,
    newPackageName: normalizedOptions.newPackageName,
  })

  logger.info(`\nProject renamed from ${normalizedOptions.currentProjectName} to ${normalizedOptions.newProjectName}`)
  logger.info(`Package name changed from ${normalizedOptions.currentPackageName} to ${normalizedOptions.newPackageName}`)
  logger.info(`\nNote: The project folder was NOT renamed. Use the move generator to also relocate the project.`)

  checkE2EProject(tree, {
    currentPackageName: normalizedOptions.currentPackageName,
    newPackageName: normalizedOptions.newPackageName,
  })

  checkCIWorkflow(tree, {
    currentProjectName: normalizedOptions.currentProjectName,
    newProjectName: normalizedOptions.newProjectName,
  })

  if (!normalizedOptions.skipFormat) {
    await formatFiles(tree)
  }
}

export default renameGenerator
