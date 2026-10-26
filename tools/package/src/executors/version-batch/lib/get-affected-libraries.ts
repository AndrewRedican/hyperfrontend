import type { WorkspaceGraph } from '@hyperfrontend/workspace/graph'
import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { getChangedFilesBetween } from '@hyperfrontend/versioning/git/operations'
import { hasTarget } from '@hyperfrontend/workspace/graph'

/**
 * Gets the list of affected libraries based on git changes.
 *
 * Uses git diff to find changed files and maps them to projects
 * through the workspace graph. Only returns libraries that have
 * a `version` target defined.
 *
 * @param workspaceRoot - Absolute path to workspace root
 * @param graph - The workspace graph
 * @param base - Base git ref (default: origin/main)
 * @param head - Head git ref (default: HEAD)
 * @returns List of affected library names that have a version target
 */
export async function getAffectedLibraries(
  workspaceRoot: string,
  graph: WorkspaceGraph,
  base = 'origin/main',
  head = 'HEAD'
): Promise<string[]> {
  const changedFiles = getChangedFilesBetween(base, head, { cwd: workspaceRoot })

  if (changedFiles.length === 0) {
    return []
  }

  const affectedProjects = createSet<string>()

  for (const file of changedFiles) {
    const project = graph.projectOf(file.split(/[/\\]/).join('/'))
    if (project !== null) {
      affectedProjects.add(project.name)
    }
  }

  return from(affectedProjects)
    .filter((projectName) => hasVersionTarget(graph, projectName))
    .sort()
}

/**
 * Whether a project can be versioned: it exists in the graph and declares a
 * `version` target.
 *
 * @param graph - The workspace graph
 * @param projectName - Name of the project, as the graph keys it
 * @returns True when the project declares a version target
 */
export function hasVersionTarget(graph: WorkspaceGraph, projectName: string): boolean {
  const project = graph.projects.get(projectName)
  return project !== undefined && hasTarget(project, 'version')
}
