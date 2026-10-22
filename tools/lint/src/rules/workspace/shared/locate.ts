/**
 * Where a file sits in the workspace: the workspace root above it, the project that owns it,
 * and whether that project is a publishable library. Each answer is read once per directory.
 *
 * @module rules/workspace/shared/locate
 */

import { dirname, relative, sep } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { findProjectRoot, findWorkspaceRoot } from '@hyperfrontend/project-scope/project/root'
import { isPublishableLibrary } from './project-file.ts'

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

/**
 * Whether a file sits directly in the workspace root.
 *
 * @param file - The absolute path
 * @returns True when its directory is the workspace root
 */
export function isAtWorkspaceRoot(file: string): boolean {
  const directory = dirname(file)
  return workspaceRootOf(directory) === directory
}

/**
 * Whether the project that owns a file is a publishable library.
 *
 * @param file - The absolute path
 * @returns True when the nearest project above it builds and publishes
 */
export function isInPublishableProject(file: string): boolean {
  const root = projectRootOf(dirname(file))
  return root !== null && isPublishableLibrary(root)
}

/**
 * The first path segment of a file under its workspace root, such as `libs`.
 *
 * @param file - The absolute path
 * @returns The segment, or null when no workspace holds the file
 */
export function workspaceSegmentOf(file: string): string | null {
  const root = workspaceRootOf(dirname(file))
  return root === null ? null : relative(root, file).split(sep)[0]
}
