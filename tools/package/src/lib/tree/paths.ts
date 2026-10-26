/**
 * The path arithmetic a generator writes into configuration files: joined POSIX fragments, and
 * the climb from a project root back to the workspace root.
 *
 * @module lib/tree/paths
 */

import { posix } from 'node:path'
import { normalizePath } from '@hyperfrontend/project-scope/core/path'

/**
 * Fragments joined and normalised as a POSIX path; a native path among them is made portable first.
 *
 * @param fragments - The parts of the path
 * @returns The joined path with forward slashes
 */
export function joinPathFragments(...fragments: readonly string[]): string {
  return posix.join(...fragments.map((fragment) => normalizePath(fragment)))
}

/**
 * The relative path from a directory back to the root it is under: one `../` per segment.
 *
 * @param directory - A directory relative to the root, such as `libs/utils/data`
 * @returns `./` for the root itself, else `../` repeated once per segment
 */
export function offsetFromRoot(directory: string): string {
  if (directory === '.') return './'
  return normalizePath(directory)
    .split(posix.sep)
    .filter((segment) => segment.length > 0)
    .map(() => '../')
    .join('')
}
