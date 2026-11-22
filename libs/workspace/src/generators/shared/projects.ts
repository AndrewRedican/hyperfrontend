/**
 * The projects a tree holds, read from every `project.json` git would not ignore, so a project
 * the same generator run created is found beside the committed ones, and the refusal of a new
 * project where one already is, or of a project or package name one already holds.
 *
 * @module generators/shared/projects
 */

import type { Tree } from './tree'
import { posix } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { getPackageNameFromProject } from './package-json'
import { readJson } from './tree'
import { aliasesOf } from './tsconfig-paths'
import { visitNotIgnoredFiles } from './walk'

/** The parts of a `project.json` a generator reads, with the project's name and root settled. */
export interface ProjectConfiguration {
  /** The project's name: the file's, or its directory's. */
  name: string
  /** The project's directory, relative to the root. */
  root: string
  /** Where its sources live. */
  sourceRoot?: string
  /** What the project is for. */
  description?: string
  /** The kind of project. */
  projectType?: string
  /** The tags the module boundaries read. */
  tags?: string[]
  /** Projects depended on without an import. */
  implicitDependencies?: string[]
  /** The targets, by name. */
  targets?: Record<string, unknown>
  /** Free-form metadata. */
  metadata?: Record<string, unknown>
}

/** A `project.json` as written. */
type ProjectFile = Omit<ProjectConfiguration, 'name' | 'root'> & Partial<Pick<ProjectConfiguration, 'name' | 'root'>>

/**
 * Every project of the tree, by name.
 *
 * @param tree - The tree read
 * @returns The projects, in path order
 *
 * @example A project the same run created is already there
 * ```typescript
 * import { getProjects, writeJson } from '@hyperfrontend/workspace/generators'
 *
 * writeJson(tree, 'libs/data/project.json', { projectType: 'library' })
 * getProjects(tree).get('data') // => { name: 'data', root: 'libs/data', projectType: 'library' }, named after its directory
 * ```
 */
export function getProjects(tree: Tree): Map<string, ProjectConfiguration> {
  const projects = createMap<string, ProjectConfiguration>()
  visitNotIgnoredFiles(tree, '', (path) => {
    if (posix.basename(path) !== 'project.json') return
    const root = posix.dirname(path)
    const file = readJson<ProjectFile>(tree, path)
    const name = file.name ?? posix.basename(root)
    projects.set(name, { ...file, name, root: file.root ?? root })
  })
  return projects
}

/**
 * One project of the tree.
 *
 * @param tree - The tree the project is read from
 * @param name - Which project
 * @returns Its configuration
 * @throws {Error} When no project of that name is there
 *
 * @example The root a generator writes under
 * ```typescript
 * const project = readProjectConfiguration(tree, 'lib-core')
 * // => { name: 'lib-core', root: 'libs/core', projectType: 'library', targets: { build: { ... } } }
 * tree.write(`${project.root}/src/generated.ts`, 'export const generated = true\n')
 * ```
 */
export function readProjectConfiguration(tree: Tree, name: string): ProjectConfiguration {
  const project = getProjects(tree).get(name)
  if (project === undefined) throw createError(`Cannot find configuration for '${name}'`)
  return project
}

/**
 * Refuses a project that is about to be created where one already is: under a directory the
 * tree already has, or under a name another project holds, so nothing is written over and no
 * two projects answer to one name.
 *
 * @param tree - The tree the new project would be written to
 * @param root - The directory it would be written under, relative to the tree's root
 * @param name - What tasks would address it by
 * @throws {Error} When the directory already exists, or a project already has the name
 *
 * @example Before a generator writes the first file of a project
 * ```typescript
 * assertNewProject(tree, 'apps/web', 'web')
 * // throws "Destination already exists: apps/web" when anything is under apps/web,
 * // and "Project name already in use: 'web' is the project at libs/web" when libs/web is named web
 * writeJson(tree, 'apps/web/project.json', { name: 'web', projectType: 'application' })
 * ```
 */
export function assertNewProject(tree: Tree, root: string, name: string): void {
  if (tree.exists(root)) throw createError(`Destination already exists: ${root}`)
  assertProjectNameFree(tree, name)
}

/**
 * Refuses a name a project of the tree already holds, so no two projects answer to one name:
 * what a new project, or one about to be renamed, is checked against.
 *
 * @param tree - The tree the projects are read from
 * @param name - The name a project is about to take
 * @throws {Error} When a project already has the name
 *
 * @example Before a project takes a name
 * ```typescript
 * assertProjectNameFree(tree, 'kernel') // passes while no project is called kernel
 * assertProjectNameFree(tree, 'web') // throws "Project name already in use: 'web' is the project at libs/web"
 * ```
 */
export function assertProjectNameFree(tree: Tree, name: string): void {
  const holder = getProjects(tree).get(name)
  if (holder !== undefined) throw createError(`Project name already in use: '${name}' is the project at ${holder.root}`)
}

/**
 * Refuses a package name another project's package already states, or the base tsconfig already
 * holds an alias under, so no two manifests share a name and no alias is written over: what a
 * new package, or one about to be renamed, is checked against.
 *
 * @param tree - The tree the projects and the base tsconfig are read from
 * @param name - The name a package is about to take
 * @param projectRoot - The directory of the project whose package takes it, whose own manifest is not looked at
 * @throws {Error} When another project's `package.json` states the name, or `tsconfig.base.json` holds an alias under it
 *
 * @example Before a package takes a name
 * ```typescript
 * assertPackageNameFree(tree, '@acme/kernel', 'libs/core') // passes while nothing is called @acme/kernel
 * assertPackageNameFree(tree, '@acme/core-ui', 'libs/core')
 * // throws "Package name already in use: '@acme/core-ui' is the package at libs/core-ui"
 * assertPackageNameFree(tree, '@acme/vendored', 'libs/core')
 * // throws "Package name already in use: '@acme/vendored/testing' is an alias in tsconfig.base.json" when only that alias is there
 * ```
 */
export function assertPackageNameFree(tree: Tree, name: string, projectRoot: string): void {
  for (const project of getProjects(tree).values()) {
    if (project.root !== projectRoot && getPackageNameFromProject(tree, project.root) === name)
      throw createError(`Package name already in use: '${name}' is the package at ${project.root}`)
  }
  const [alias] = aliasesOf(tree, name)
  if (alias !== undefined) throw createError(`Package name already in use: '${alias}' is an alias in tsconfig.base.json`)
}
