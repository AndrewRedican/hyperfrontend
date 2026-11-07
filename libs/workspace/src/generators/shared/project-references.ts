/**
 * Renames a project in every other project's configuration: the `implicitDependencies` that
 * list it and the `dependsOn` entries that name it.
 *
 * @module generators/shared/project-references
 */

import type { Tree } from './tree'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { joinPathFragments } from './paths'
import { getProjects } from './projects'
import { updateJson } from './tree'

/** A `project.json` as far as its references to other projects go. */
interface ReferencingProjectJson {
  /** Projects depended on without an import */
  implicitDependencies?: unknown
  /** The targets, whose `dependsOn` may name a project */
  targets?: Record<string, unknown>
}

/** A target as far as the projects its `dependsOn` names go. */
interface TargetWithDependsOn {
  /** The tasks the target runs after */
  dependsOn?: unknown[]
}

/** How a project is renamed in the configurations that refer to it. */
export interface UpdateReferencesOptions {
  /** The project's current name */
  currentProjectName: string
  /** The project's new name */
  newProjectName: string
  /** The roots of projects whose configuration is left alone, such as the moved project's old and new roots */
  excludeRoots?: string[]
}

/**
 * Renames a project in every other project's `implicitDependencies` and `dependsOn` entries.
 *
 * @param tree - The tree the configurations live in
 * @param options - The current and new names, and the roots to skip
 */
export function updateProjectReferences(tree: Tree, options: UpdateReferencesOptions): void {
  if (options.currentProjectName === options.newProjectName) return
  const excludeRoots = options.excludeRoots ?? []
  for (const [projectName, projectConfig] of getProjects(tree)) {
    if (projectName === options.currentProjectName || excludeRoots.includes(projectConfig.root)) continue
    const projectJsonPath = joinPathFragments(projectConfig.root, 'project.json')
    const rawContent = tree.read(projectJsonPath, 'utf-8')
    if (rawContent === null || !rawContent.includes(options.currentProjectName)) continue
    updateJson<ReferencingProjectJson>(tree, projectJsonPath, (json) => {
      if (isArray(json.implicitDependencies)) {
        json.implicitDependencies = (json.implicitDependencies as string[]).map((dependency) =>
          dependency === options.currentProjectName ? options.newProjectName : dependency
        )
      }
      for (const target of values(json.targets ?? {})) {
        const targetConfig = target as TargetWithDependsOn
        if (isArray(targetConfig.dependsOn)) {
          targetConfig.dependsOn = targetConfig.dependsOn.map((dependency) =>
            dependency === options.currentProjectName ? options.newProjectName : dependency
          )
        }
      }
      return json
    })
  }
}
