import { relative, resolve, sep, posix } from 'node:path'

// ref: portable-path mirror of normalizePath, relativePath and workspaceRelativePath from @hyperfrontend/project-scope/core/path; the runner bootstraps every library's tests, so it imports nothing from the workspace

/**
 * Converts a native path to its portable spelling, with `/` as the only separator.
 *
 * Portable paths are for values that act as data: keys, report entries, table rows and
 * globs. Only the platform separator is rewritten, so a backslash in a POSIX file name is kept.
 *
 * @param filePath - A path as the platform spells it.
 * @returns The path with forward slashes.
 * @example Spelling a native path portably
 * ```ts
 * normalizePath(join('libs', 'example', 'src')) // => 'libs/example/src' on every platform
 * ```
 */
export function normalizePath(filePath: string): string {
  return filePath.split(sep).join(posix.sep)
}

/**
 * Renders the portable path from one location to another.
 *
 * @param from - The directory the result is relative to.
 * @param to - The path to reach.
 * @returns The relative path with forward slashes.
 * @example Naming a report relative to the project
 * ```ts
 * relativePath('/repo/libs/example', '/repo/coverage/libs/example/lcov.node.info') // => '../../coverage/libs/example/lcov.node.info'
 * ```
 */
export function relativePath(from: string, to: string): string {
  return normalizePath(relative(from, to))
}

/**
 * Converts a path into its workspace-relative portable form.
 *
 * An absolute path is made relative to the workspace root, and a relative path is taken as
 * already relative to it.
 *
 * @param workspaceRoot - Absolute path of the workspace root.
 * @param filePath - Absolute path, or a path relative to the workspace root.
 * @returns The workspace-relative path with forward slashes.
 * @example Accepting absolute and already-relative paths alike
 * ```ts
 * workspaceRelativePath('/repo', '/repo/libs/example/src/index.ts') // => 'libs/example/src/index.ts'
 * workspaceRelativePath('/repo', 'libs/example/src/index.ts') // => 'libs/example/src/index.ts'
 * ```
 */
export function workspaceRelativePath(workspaceRoot: string, filePath: string): string {
  return relativePath(workspaceRoot, resolve(workspaceRoot, filePath))
}
