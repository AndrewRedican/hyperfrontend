/**
 * The `rename` generator: a project's new name, carried into its manifests, its alias, the
 * projects that refer to it, its README and module header, and the project that tests it.
 *
 * @module generators/rename/generator
 */

import type { Tree } from '../../runner/contract'
import type { NamedJson } from '../shared/json-updaters'
import type { RenameGeneratorOptions } from './options'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { logger } from '../../executors/shared/logger'
import { updateContentReferences } from '../shared/content-updaters'
import { renameE2eProject } from '../shared/e2e-project'
import { formatFiles } from '../shared/format'
import { replaceDescriptionPackageName } from '../shared/json-updaters'
import { getPackageNameFromProject } from '../shared/package-json'
import { joinPathFragments } from '../shared/paths'
import { updateProjectReferences } from '../shared/project-references'
import { readProjectConfiguration } from '../shared/projects'
import { scopeOf, scopedName } from '../shared/scope'
import { updateJson } from '../shared/tree'
import { renameTsConfigPaths } from '../shared/tsconfig-paths'

/** The file whose aliases a rename rewrites. */
const BASE_TSCONFIG = 'tsconfig.base.json'

/** The options settled. */
export interface RenamePlan {
  /** The project's current name */
  currentProjectName: string
  /** The project's directory, relative to the root */
  projectRoot: string
  /** The project's new name */
  newProjectName: string
  /** The package's current name, or undefined for a project with no package */
  currentPackageName: string | undefined
  /** The package's new name, or undefined for a project with no package */
  newPackageName: string | undefined
}

/**
 * Settles the options: the project's root and its package's names.
 *
 * @param tree - The tree the project lives in
 * @param options - The options as given
 * @returns The root and the names the rename writes from
 * @throws {Error} When the new name is the current one
 *
 * @example The package keeps its scope
 * ```typescript
 * planRename(tree, { project: 'my-utils', newName: 'better-utils' })
 * // => {
 * //   currentProjectName: 'my-utils',
 * //   projectRoot: 'libs/my-utils',
 * //   newProjectName: 'better-utils',
 * //   currentPackageName: '@acme/my-utils',
 * //   newPackageName: '@acme/better-utils',
 * // }
 * ```
 */
export function planRename(tree: Tree, options: RenameGeneratorOptions): RenamePlan {
  if (options.project === options.newName) throw createError(`New name must be different from current name: ${options.project}`)
  const projectRoot = readProjectConfiguration(tree, options.project).root
  const currentPackageName = getPackageNameFromProject(tree, projectRoot) ?? undefined
  return {
    currentProjectName: options.project,
    projectRoot,
    newProjectName: options.newName,
    currentPackageName,
    newPackageName:
      currentPackageName === undefined ? undefined : (options.packageName ?? scopedName(scopeOf(currentPackageName), options.newName)),
  }
}

/**
 * Renames a project: its `project.json` and `package.json`, its aliases in `tsconfig.base.json`,
 * the `implicitDependencies` and `dependsOn` entries that name it, the package name its README
 * and module header mention, and the project that tests it. The directory stays where it is;
 * the `move` generator relocates it.
 *
 * @param tree - The tree, rooted at the workspace
 * @param options - Which project, and its new names
 * @returns Resolves when the rename is written
 * @throws {Error} When the project is unknown or the new name is the current one
 *
 * @example Renaming a project from the command line
 * ```bash
 * npx hf generate rename my-utils better-utils
 * ```
 *
 * @example Choosing the package name rather than deriving it
 * ```typescript
 * import renameGenerator from '@hyperfrontend/workspace/generators/rename'
 *
 * await renameGenerator(tree, { project: 'my-utils', newName: 'better-utils', packageName: '@acme/utils' })
 * ```
 */
export async function renameGenerator(tree: Tree, options: RenameGeneratorOptions): Promise<void> {
  const plan = planRename(tree, options)
  const { currentPackageName, newPackageName } = plan
  const packages = currentPackageName !== undefined && newPackageName !== undefined ? { currentPackageName, newPackageName } : undefined
  updateJson<NamedJson>(tree, joinPathFragments(plan.projectRoot, 'project.json'), (json) => {
    json.name = plan.newProjectName
    if (packages !== undefined) replaceDescriptionPackageName(json, packages.currentPackageName, packages.newPackageName)
    return json
  })
  if (packages !== undefined) {
    updateJson<NamedJson>(tree, joinPathFragments(plan.projectRoot, 'package.json'), (json) => {
      json.name = packages.newPackageName
      replaceDescriptionPackageName(json, packages.currentPackageName, packages.newPackageName)
      return json
    })
    if (tree.exists(BASE_TSCONFIG)) renameTsConfigPaths(tree, packages)
    updateContentReferences(tree, { projectRoot: plan.projectRoot, ...packages })
  }
  updateProjectReferences(tree, { currentProjectName: plan.currentProjectName, newProjectName: plan.newProjectName })
  logger.info(`Project renamed from ${plan.currentProjectName} to ${plan.newProjectName}`)
  if (packages !== undefined) {
    logger.info(`Package name changed from ${packages.currentPackageName} to ${packages.newPackageName}`)
    const e2eRoot = renameE2eProject(tree, {
      currentProjectName: plan.currentProjectName,
      newProjectName: plan.newProjectName,
      ...packages,
    })
    if (e2eRoot !== undefined) logger.info(`The project testing the package was renamed in ${e2eRoot}; its directory was not moved`)
  }
  logger.info('The project directory was not renamed; the move generator relocates a project')
  if (!options.skipFormat) await formatFiles(tree)
}

export default renameGenerator
