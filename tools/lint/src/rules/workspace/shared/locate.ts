/**
 * Where a file sits in the workspace: the workspace root above it and the project that owns it.
 * Each answer is read once per directory.
 *
 * @module rules/workspace/shared/locate
 */

import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { findProjectRoot, findWorkspaceRoot } from '@hyperfrontend/project-scope/project/root'

const workspaceRoots = createMap<string, string | null>()
const projectRoots = createMap<string, string | null>()

/**
 * An answer read once per directory.
 *
 * @param cache - Where answers are kept
 * @param directory - The directory asked about
 * @param find - How to answer the first time
 * @returns The answer
 */
function once(cache: Map<string, string | null>, directory: string, find: (directory: string) => string | null): string | null {
  const known = cache.get(directory)
  if (known !== undefined) return known
  const answer = find(directory)
  cache.set(directory, answer)
  return answer
}

/**
 * The workspace root above a directory, as project-scope finds it: a workspace marker such as
 * `nx.json`, else a manifest declaring workspaces, else the nearest manifest.
 *
 * @param directory - Where to start
 * @returns The root, or null
 */
export function workspaceRootOf(directory: string): string | null {
  return once(workspaceRoots, directory, findWorkspaceRoot)
}

/**
 * The root of the project that owns a directory, as project-scope finds it: the nearest
 * directory with a `project.json`, or a manifest that looks like a project's.
 *
 * @param directory - Where to start
 * @returns The root, or null
 */
export function projectRootOf(directory: string): string | null {
  return once(projectRoots, directory, findProjectRoot)
}
