/**
 * The projects a tree holds, read from every `project.json` git would not ignore, so a project
 * the same generator run created is found beside the committed ones.
 *
 * @module lib/tree/projects
 */

import type { Tree } from './tree'
import { posix } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { readJson } from './tree'
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
 */
export function readProjectConfiguration(tree: Tree, name: string): ProjectConfiguration {
  const project = getProjects(tree).get(name)
  if (project === undefined) throw createError(`Cannot find configuration for '${name}'`)
  return project
}
