/* lint-disable workspace/lib-require-jsdoc-example */
/**
 * The steps of a move: settling where the project goes and what it is called there, copying
 * and deleting its files, and rewriting its manifests, its aliases and what refers to it.
 *
 * @module generators/move/lib/move-helpers
 */

import type { Tree } from '../../../runner/contract'
import type { NamedJson } from '../../shared/json-updaters'
import type { MoveGeneratorOptions } from '../options'
import { posix } from 'node:path'
import { updateContentReferences as updateContentRefsShared } from '../../shared/content-updaters'
import { replaceDescriptionPackageName } from '../../shared/json-updaters'
import { names } from '../../shared/names'
import { getPackageNameFromProject } from '../../shared/package-json'
import { joinPathFragments, offsetFromRoot } from '../../shared/paths'
import { updateProjectReferences as updateProjectRefsShared } from '../../shared/project-references'
import { readProjectConfiguration } from '../../shared/projects'
import { globalNameOf, scopeOf, scopedName } from '../../shared/scope'
import { updateJson } from '../../shared/tree'
import { moveTsConfigPaths } from '../../shared/tsconfig-paths'
import { visitNotIgnoredFiles } from '../../shared/walk'

/** A bundle's options as far as its global name goes. */
interface GlobalNamed {
  /** The name the bundle registers on the global object */
  globalName?: string
}

/** The bundles of a build as far as their global names go. */
interface BundleOptions {
  /** The iife bundle */
  iife?: GlobalNamed
  /** The umd bundle */
  umd?: GlobalNamed
}

/** A build target as far as its bundles go. */
interface BuildTarget {
  /** Its options */
  options?: BundleOptions
}

/** The targets of a moved project as far as the move rewrites them. */
interface MovedTargets {
  /** The build target */
  build?: BuildTarget
}

/** A moved project.json as far as the move rewrites it. */
interface MovedProjectJson extends NamedJson {
  /** The targets */
  targets?: MovedTargets
}

/** The options settled. */
export interface MovePlan {
  /** The project's current name */
  projectName: string
  /** The project's current directory, relative to the root */
  currentProjectRoot: string
  /** The project's new directory, relative to the root */
  newProjectRoot: string
  /** The project's new name; its current one when the names are kept */
  newProjectName: string
  /** The package's current name, or undefined for a project with no package */
  currentPackageName: string | undefined
  /** The package's new name, or undefined for a project with no package */
  newPackageName: string | undefined
  /** Whether the names follow the new location */
  updateName: boolean
  /** The path from the new project root to the workspace root */
  newOffsetFromRoot: string
}

/**
 * Settles the options: where the project goes and what it and its package are called there.
 *
 * @param tree - The tree the project lives in
 * @param options - The options as given
 * @returns The roots, the names and the offset the move writes from
 */
export function planMove(tree: Tree, options: MoveGeneratorOptions): MovePlan {
  const currentProjectRoot = readProjectConfiguration(tree, options.project).root
  const directoryName = options.newName === undefined ? posix.basename(currentProjectRoot) : names(options.newName).fileName
  const newProjectRoot = joinPathFragments(options.destination, directoryName)
  const updateName = options.updateName ?? true
  const currentPackageName = getPackageNameFromProject(tree, currentProjectRoot) ?? undefined
  return {
    projectName: options.project,
    currentProjectRoot,
    newProjectRoot,
    newProjectName: updateName ? (options.projectName ?? directoryName) : options.project,
    currentPackageName,
    newPackageName:
      currentPackageName === undefined || !updateName
        ? currentPackageName
        : (options.packageName ?? scopedName(scopeOf(currentPackageName), directoryName)),
    updateName,
    newOffsetFromRoot: offsetFromRoot(newProjectRoot),
  }
}

/**
 * Copies every file git would not ignore from one directory to another.
 *
 * @param tree - The tree the files live in
 * @param source - The directory copied from, relative to the root
 * @param destination - The directory copied to, relative to the root
 */
export function copyDirectory(tree: Tree, source: string, destination: string): void {
  visitNotIgnoredFiles(tree, source, (filePath) => {
    const content = tree.read(filePath)
    if (content !== null) tree.write(joinPathFragments(destination, filePath.slice(source.length)), content)
  })
}

/**
 * Deletes every file git would not ignore under a directory.
 *
 * @param tree - The tree the files live in
 * @param directory - The directory emptied, relative to the root
 */
export function deleteDirectory(tree: Tree, directory: string): void {
  visitNotIgnoredFiles(tree, directory, (filePath) => tree.delete(filePath))
}

/**
 * Rewrites the moved `project.json`: its name, the package name its description mentions, and
 * the global its browser bundles register under, when the names follow the move.
 *
 * @param tree - The tree the file lives in
 * @param plan - The settled move
 */
export function updateProjectJson(tree: Tree, plan: MovePlan): void {
  if (!plan.updateName) return
  updateJson<MovedProjectJson>(tree, joinPathFragments(plan.newProjectRoot, 'project.json'), (json) => {
    json.name = plan.newProjectName
    if (plan.currentPackageName !== undefined && plan.newPackageName !== undefined) {
      replaceDescriptionPackageName(json, plan.currentPackageName, plan.newPackageName)
      const bundles = json.targets?.build?.options
      if (bundles?.iife !== undefined) bundles.iife.globalName = globalNameOf(plan.newPackageName)
      if (bundles?.umd !== undefined) bundles.umd.globalName = globalNameOf(plan.newPackageName)
    }
    return json
  })
}

/**
 * Rewrites the moved `package.json`: its name and the package name its description mentions,
 * when the names follow the move.
 *
 * @param tree - The tree the file lives in
 * @param plan - The settled move
 */
export function updatePackageJson(tree: Tree, plan: MovePlan): void {
  if (!plan.updateName || plan.currentPackageName === undefined || plan.newPackageName === undefined) return
  const { currentPackageName, newPackageName } = plan
  updateJson<NamedJson>(tree, joinPathFragments(plan.newProjectRoot, 'package.json'), (json) => {
    json.name = newPackageName
    replaceDescriptionPackageName(json, currentPackageName, newPackageName)
    return json
  })
}

export { updateLintConfig, updateTsConfigJson, updateTsConfigLibJson, updateTsConfigSpecJson } from './config-updaters'

/**
 * Moves the package's aliases in `tsconfig.base.json` to the new root, under the new name when
 * the names follow the move.
 *
 * @param tree - The tree the file lives in
 * @param plan - The settled move
 */
export function updateTsConfigPaths(tree: Tree, plan: MovePlan): void {
  if (plan.currentPackageName === undefined || plan.newPackageName === undefined || !tree.exists('tsconfig.base.json')) return
  moveTsConfigPaths(tree, {
    currentProjectRoot: plan.currentProjectRoot,
    newProjectRoot: plan.newProjectRoot,
    currentPackageName: plan.currentPackageName,
    newPackageName: plan.newPackageName,
    updateName: plan.updateName,
  })
}

/**
 * Renames the project in every other project's configuration, when the names follow the move.
 *
 * @param tree - The tree the configurations live in
 * @param plan - The settled move
 */
export function updateProjectReferences(tree: Tree, plan: MovePlan): void {
  if (!plan.updateName) return
  updateProjectRefsShared(tree, {
    currentProjectName: plan.projectName,
    newProjectName: plan.newProjectName,
    excludeRoots: [plan.currentProjectRoot, plan.newProjectRoot],
  })
}

/**
 * Rewrites the package name the moved README and module header mention, when the names follow
 * the move.
 *
 * @param tree - The tree the files live in
 * @param plan - The settled move
 */
export function updateContentReferences(tree: Tree, plan: MovePlan): void {
  if (!plan.updateName || plan.currentPackageName === undefined || plan.newPackageName === undefined) return
  updateContentRefsShared(tree, {
    projectRoot: plan.newProjectRoot,
    currentPackageName: plan.currentPackageName,
    newPackageName: plan.newPackageName,
  })
}
