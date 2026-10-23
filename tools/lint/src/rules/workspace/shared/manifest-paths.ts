/**
 * How the manifest rules read an export path: whether it is relative, and the prefix of the
 * package's own source directory.
 *
 * @module rules/workspace/shared/manifest-paths
 */

import { posix } from 'node:path'

/** The prefix of a path that names the package's own source directory. */
export const SOURCE_PREFIX = `.${posix.sep}src${posix.sep}`

/**
 * Whether an export path is relative, as `./x` and `../x` are, rather than a bare specifier.
 *
 * @param path - An export path as written in a manifest, which always uses `/`
 * @returns True for a relative path
 */
export function isRelativePath(path: string): boolean {
  return path.startsWith(`.${posix.sep}`) || path.startsWith(`..${posix.sep}`)
}
