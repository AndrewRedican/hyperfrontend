import type { Tree } from '@nx/devkit'
import { getProjects, joinPathFragments, updateJson } from '@nx/devkit'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Slice of an Nx target config we mutate while updating project references.
 */
type TargetWithDependsOn = {
  /** Target dependencies */
  dependsOn?: unknown[]
}

/**
 * Object form of an entry in `dependsOn` (the alternative to a plain target name).
 */
type DependsOnObject = {
  /** Projects this target depends on */
  projects?: string | string[]
}

/**
 * Options for updating project references.
 */
export interface UpdateReferencesOptions {
  /** Current project name */
  currentProjectName: string
  /** New project name */
  newProjectName: string
  /** Project roots to exclude from updates */
  excludeRoots?: string[]
}

/**
 * Update references to a project in all other project configurations.
 * Updates:
 * - implicitDependencies arrays
 * - target dependsOn arrays (string and object forms)
 *
 * @param tree - The virtual file system tree
 * @param options - Options with current/new project names
 */
export function updateProjectReferences(tree: Tree, options: UpdateReferencesOptions): void {
  if (options.currentProjectName === options.newProjectName) {
    return
  }

  const projects = getProjects(tree)
  const excludeRoots = options.excludeRoots ?? []

  for (const [projectName, projectConfig] of projects) {
    // why: Skip the project being renamed
    if (projectName === options.currentProjectName) {
      continue
    }

    // why: Skip excluded roots (e.g., old and new project roots during move)
    if (excludeRoots.includes(projectConfig.root)) {
      continue
    }

    const projectJsonPath = joinPathFragments(projectConfig.root, 'project.json')
    if (!tree.exists(projectJsonPath)) {
      continue
    }

    const rawContent = tree.read(projectJsonPath, 'utf-8')
    if (!rawContent || !rawContent.includes(options.currentProjectName)) {
      continue
    }

    updateJson(tree, projectJsonPath, (json) => {
      if (isArray(json.implicitDependencies)) {
        json.implicitDependencies = json.implicitDependencies.map((dep: string) =>
          dep === options.currentProjectName ? options.newProjectName : dep
        )
      }

      if (json.targets) {
        for (const target of values(json.targets)) {
          const targetConfig = target as TargetWithDependsOn
          if (isArray(targetConfig.dependsOn)) {
            targetConfig.dependsOn = targetConfig.dependsOn.map((dep) => {
              if (typeof dep === 'string' && dep === options.currentProjectName) {
                return options.newProjectName
              }
              if (typeof dep === 'object' && dep !== null) {
                const depObj = dep as DependsOnObject
                if (depObj.projects === options.currentProjectName) {
                  depObj.projects = options.newProjectName
                } else if (isArray(depObj.projects)) {
                  depObj.projects = depObj.projects.map((p) => (p === options.currentProjectName ? options.newProjectName : p))
                }
              }
              return dep
            })
          }
        }
      }

      return json
    })
  }
}
