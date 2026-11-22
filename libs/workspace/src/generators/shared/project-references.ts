/**
 * Renames a project in every configuration that refers to it: the `implicitDependencies` that
 * list it, the `dependsOn` entries that name a task of it, and the `inputs` that read from it,
 * in the other projects and in the workspace file.
 *
 * @module generators/shared/project-references
 */

import type { Tree } from './tree'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { entries, values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { joinPathFragments } from './paths'
import { getProjects } from './projects'
import { amendJson } from './tree'

/** The file that holds the workspace's defaults and named inputs. */
const WORKSPACE_FILE = 'hf.json'

/** What `projects` reads in an input when it means the project the input belongs to, not one of that name. */
const SELF = 'self'

/** A target, or the defaults of one, as far as it refers to other projects. */
interface ReferencingTarget {
  /** The tasks the target runs after */
  dependsOn?: unknown
  /** What the target reads */
  inputs?: unknown
}

/** A `project.json` as far as its references to other projects go. */
interface ReferencingProjectJson {
  /** Projects depended on without an import */
  implicitDependencies?: unknown
  /** The targets, whose `dependsOn` and `inputs` may name a project */
  targets?: Record<string, ReferencingTarget>
}

/** The workspace file as far as its references to projects go. */
interface ReferencingWorkspaceFile {
  /** The named inputs, each a list that may read from a project */
  namedInputs?: Record<string, unknown>
  /** The defaults of each target */
  targetDefaults?: Record<string, ReferencingTarget>
}

/** An input written as an object, as far as the projects it reads from go. */
interface ProjectsInput {
  /** Whose input it is: one project, or several */
  projects?: unknown
}

/** A project's current name and the one it takes. */
interface Rename {
  /** The project's current name */
  readonly currentProjectName: string
  /** The project's new name */
  readonly newProjectName: string
}

/** How a project is renamed in the configurations that refer to it. */
export interface UpdateReferencesOptions {
  /** The project's current name */
  currentProjectName: string
  /** The project's new name */
  newProjectName: string
  /** The roots of projects whose configuration is left alone, such as the directory a moved project leaves */
  excludeRoots?: string[]
}

/**
 * A project name with the rename applied.
 *
 * @param name - A name some configuration lists
 * @param rename - The project's current and new names
 * @returns The new name for the renamed project, any other value as it is
 */
function renamed(name: unknown, rename: Rename): unknown {
  return name === rename.currentProjectName ? rename.newProjectName : name
}

/**
 * A `dependsOn` entry with the rename applied. Only `project:target` names a project; a bare
 * entry is a target of the depending project, whatever it is called.
 *
 * @param entry - The entry as written
 * @param rename - The project's current and new names
 * @returns The entry naming the task under the project's new name, or the entry as it is
 */
function renamedTask(entry: unknown, rename: Rename): unknown {
  if (typeof entry !== 'string' || !entry.startsWith(`${rename.currentProjectName}:`)) return entry
  return `${rename.newProjectName}${entry.slice(rename.currentProjectName.length)}`
}

/**
 * An input with the rename applied to the projects it reads from.
 *
 * @param input - The input as written: a string, or an object that may name projects
 * @param rename - The project's current and new names
 * @returns The input reading from the project under its new name, or the input as it is
 */
function renamedInput(input: unknown, rename: Rename): unknown {
  if (typeof input !== 'object' || input === null) return input
  const { projects } = input as ProjectsInput
  if (isArray(projects)) return { ...input, projects: projects.map((name) => renamed(name, rename)) }
  // why: the word that means the input's own project is no reference to a project that happens to be called by it
  return projects === SELF ? input : { ...input, projects: renamed(projects, rename) }
}

/**
 * Applies the rename to what a target runs after and reads, in place.
 *
 * @param target - A target, or the defaults of one
 * @param rename - The project's current and new names
 */
function renameInTarget(target: ReferencingTarget, rename: Rename): void {
  if (isArray(target.dependsOn)) target.dependsOn = target.dependsOn.map((entry) => renamedTask(entry, rename))
  if (isArray(target.inputs)) target.inputs = target.inputs.map((input) => renamedInput(input, rename))
}

/**
 * Renames a project in every other project's `implicitDependencies`, in the `project:target`
 * entries of `dependsOn` and in the `inputs` that read from it, and likewise in the target
 * defaults and the named inputs of `hf.json`. A project whose name only starts with the renamed
 * one keeps its own, a bare `dependsOn` entry stays a target of its own project, and a file with
 * nothing to rename is left as it is written.
 *
 * @param tree - The tree the configurations live in
 * @param options - The current and new names, and the roots to skip
 *
 * @example The configurations that refer to a renamed project follow it
 * ```typescript
 * updateProjectReferences(tree, { currentProjectName: 'lib-core', newProjectName: 'lib-kernel' })
 * // e2e/core/project.json: implicitDependencies ['lib-core'] became ['lib-kernel']
 * // apps/shell/project.json: a target's dependsOn ['lib-core:build', '^build'] became ['lib-kernel:build', '^build']
 * // hf.json: an input { input: 'production', projects: 'lib-core' } now reads from 'lib-kernel'
 * // libs/core-ui/project.json: dependsOn ['lib-core-ui:build'] is untouched
 * ```
 */
export function updateProjectReferences(tree: Tree, options: UpdateReferencesOptions): void {
  if (options.currentProjectName === options.newProjectName) return
  const excludeRoots = options.excludeRoots ?? []
  for (const [projectName, projectConfig] of getProjects(tree)) {
    if (projectName === options.currentProjectName || excludeRoots.includes(projectConfig.root)) continue
    const projectJsonPath = joinPathFragments(projectConfig.root, 'project.json')
    const rawContent = tree.read(projectJsonPath, 'utf-8')
    if (rawContent === null || !rawContent.includes(options.currentProjectName)) continue
    amendJson<ReferencingProjectJson>(tree, projectJsonPath, (json) => {
      if (isArray(json.implicitDependencies)) json.implicitDependencies = json.implicitDependencies.map((name) => renamed(name, options))
      for (const target of values(json.targets ?? {})) renameInTarget(target, options)
      return json
    })
  }
  if (!tree.exists(WORKSPACE_FILE)) return
  amendJson<ReferencingWorkspaceFile>(tree, WORKSPACE_FILE, (json) => {
    for (const target of values(json.targetDefaults ?? {})) renameInTarget(target, options)
    for (const [name, inputs] of entries(json.namedInputs ?? {})) {
      if (isArray(inputs)) (json.namedInputs as Record<string, unknown>)[name] = inputs.map((input) => renamedInput(input, options))
    }
    return json
  })
}
