import type { ProjectGraph } from '@nx/devkit'
import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { getChangedFilesBetween } from '@hyperfrontend/versioning/git/operations'

/**
 * Gets the list of affected libraries based on git changes.
 *
 * Uses git diff to find changed files and maps them to projects
 * using the Nx project graph. Only returns libraries that have
 * a `version` target defined.
 *
 * @param workspaceRoot - Absolute path to workspace root
 * @param projectGraph - Nx project graph
 * @param base - Base git ref (default: origin/main)
 * @param head - Head git ref (default: HEAD)
 * @returns List of affected library names that have a version target
 */
export async function getAffectedLibraries(
  workspaceRoot: string,
  projectGraph: ProjectGraph,
  base = 'origin/main',
  head = 'HEAD'
): Promise<string[]> {
  const changedFiles = getChangedFilesBetween(base, head, { cwd: workspaceRoot })

  if (changedFiles.length === 0) {
    return []
  }

  const affectedProjects = createSet<string>()

  for (const file of changedFiles) {
    const project = findProjectForFile(file, projectGraph)
    if (project) {
      affectedProjects.add(project)
    }
  }

  const librariesWithVersionTarget = from(affectedProjects).filter((projectName) => {
    const project = projectGraph.nodes[projectName]
    if (!project) {
      return false
    }

    const targets = project.data?.targets
    return targets && 'version' in targets
  })

  return librariesWithVersionTarget.sort()
}

/**
 * Finds the project that owns a given file path.
 *
 * Uses the project graph to find which project contains the file
 * based on project root paths.
 *
 * @param filePath - File path relative to workspace root
 * @param projectGraph - Nx project graph
 * @returns Project name or null if not found
 */
function findProjectForFile(filePath: string, projectGraph: ProjectGraph): string | null {
  const normalizedPath = filePath.replace(/\\/g, '/')

  const projects = entries(projectGraph.nodes)
    .map(([name, node]) => ({
      name,
      root: node.data.root,
    }))
    .filter((p) => normalizedPath.startsWith(p.root + '/') || normalizedPath === p.root)
    .sort((a, b) => b.root.length - a.root.length)

  return projects.length > 0 ? projects[0].name : null
}
