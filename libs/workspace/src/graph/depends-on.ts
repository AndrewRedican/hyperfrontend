/**
 * The tasks a task runs after, read from its target's `dependsOn` in the three forms the
 * workspace writes: `target` is the project's own target, `^target` that target of each project
 * the project has an edge to, and `project:target` the target of the project the part before the
 * first colon names (a string whose first segment names no project is the project's own target).
 * An e2e task's `^build` is the build of the library it tests alone. Any other entry is refused,
 * so no prerequisite is ever skipped unread.
 *
 * @module graph/depends-on
 */

import type { WorkspaceGraph } from './build'
import type { ProjectEdge, ProjectRecord } from './model'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { targetDependsOn } from './inputs'
import { hasTarget } from './workspace'

/** A task another task runs after. */
export interface Prerequisite {
  /** `<project>:<target>`. */
  readonly id: string
  /** The project. */
  readonly project: string
  /** The target. */
  readonly target: string
}

/** What one `dependsOn` entry names: a target of some projects. */
interface Named {
  /** The projects whose target is meant. */
  readonly projects: readonly string[]
  /** The target. */
  readonly target: string
}

/**
 * The library an e2e project tests.
 *
 * @param graph - The graph the projects belong to
 * @param project - A project with an e2e target
 * @returns The first implicit dependency with a build target, or null
 */
export function libraryOfE2e(graph: WorkspaceGraph, project: ProjectRecord): ProjectRecord | null {
  for (const name of project.implicitDependencies) {
    const candidate = graph.projects.get(name)
    if (candidate !== undefined && hasTarget(candidate, 'build')) return candidate
  }
  return null
}

/**
 * Reads one `dependsOn` entry.
 *
 * @param graph - The graph whose projects an entry may name
 * @param project - The depending project
 * @param target - The depending target
 * @param entry - The entry as written
 * @returns The projects and the target it names
 * @throws {Error} When the entry is not a string
 */
function named(graph: WorkspaceGraph, project: ProjectRecord, target: string, entry: unknown): Named {
  if (typeof entry !== 'string')
    throw createError(
      `${project.name}:${target} depends on ${stringify(entry)}, which is not one of the forms read: target, ^target or project:target`
    )
  if (entry.startsWith('^')) {
    const depended = entry.slice(1)
    if (target === 'e2e' && depended === 'build') {
      // why: the e2e executor packs only the library under test from dist and loads every other workspace package from source through tsconfig.base.json
      const library = libraryOfE2e(graph, project)
      return { projects: library === null ? [] : [library.name], target: depended }
    }
    return { projects: (graph.edges.get(project.name) as readonly ProjectEdge[]).map((edge) => edge.target), target: depended }
  }
  const colon = entry.indexOf(':')
  if (colon !== -1 && graph.projects.has(entry.slice(0, colon)))
    return { projects: [entry.slice(0, colon)], target: entry.slice(colon + 1) }
  return { projects: [project.name], target: entry }
}

/**
 * The tasks a project's target runs after that exist: the target of each project an entry names,
 * when that project has it; each once, in the order the entries name them, and never the task itself.
 * The entries are the project's own `dependsOn`, else the workspace defaults.
 *
 * @param graph - The graph the projects belong to
 * @param project - The depending project
 * @param target - The depending target
 * @returns The tasks that must succeed before the target runs
 * @throws {Error} When an entry is not one of the forms read
 */
export function prerequisitesOf(graph: WorkspaceGraph, project: ProjectRecord, target: string): Prerequisite[] {
  const tasks = createMap<string, Prerequisite>()
  for (const entry of targetDependsOn(graph.root, project, target)) {
    const { projects, target: depended } = named(graph, project, target, entry)
    for (const name of projects) {
      const id = `${name}:${depended}`
      const candidate = graph.projects.get(name)
      if (candidate !== undefined && hasTarget(candidate, depended) && id !== `${project.name}:${target}`)
        tasks.set(id, { id, project: name, target: depended })
    }
  }
  return [...tasks.values()]
}
