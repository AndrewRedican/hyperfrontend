import type { WorkspaceGraph } from '@hyperfrontend/workspace/graph'
import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { getChangedFilesBetween } from '@hyperfrontend/versioning/git/operations'
import { hasTarget } from '@hyperfrontend/workspace/graph'
import { selectReleaseBuilds } from '../../version/lib/graph-change-sources'
import { rebuiltProjects } from './rebuilt-projects'

/**
 * Gets the libraries a change may make due a release.
 *
 * A library is a candidate when it owns a changed file, or when the workspace graph
 * selects its build for the change because of a file another project owns. Only
 * libraries that have a `version` target are returned; the version flow then decides
 * whether each one is bumped.
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

  // why: a library that owns no changed file is still due a release when the graph rebuilds it for a change to code it ships or to the toolchain that builds it
  for (const name of rebuiltProjects(graph, selectReleaseBuilds(graph, workspaceRoot, base, head))) affectedProjects.add(name)

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
