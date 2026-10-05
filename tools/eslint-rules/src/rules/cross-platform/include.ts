import type { IncludeSelector } from './types'
import { posix, relative, sep } from 'node:path'
import { isPublishableLibrary } from '../../utils/nx-project'

/**
 * The files the rule checks when no `include` option is given: publishable libraries only.
 */
export const DEFAULT_INCLUDE: readonly IncludeSelector[] = [{ publishableLibraries: true }]

/**
 * Tests whether any `include` entry selects a file. Entries only ever add files, so a `files`
 * entry never limits which publishable libraries are checked, and the other way round.
 *
 * @param filename - Absolute path of the file being linted.
 * @param projectRoot - Absolute root of the project that owns the file.
 * @param workspaceRoot - Absolute workspace root, or null when none was found.
 * @param include - The selectors to try.
 * @returns True when at least one selector selects the file.
 *
 * @example Checking the tools alongside the publishable libraries
 * ```typescript
 * isIncluded('/repo/tools/app/src/run.ts', '/repo/tools/app', '/repo', [{ publishableLibraries: true }, { files: ['tools/**'] }]) // true
 * ```
 */
export function isIncluded(
  filename: string,
  projectRoot: string,
  workspaceRoot: string | null,
  include: readonly IncludeSelector[]
): boolean {
  const file = workspaceRoot === null ? null : relative(workspaceRoot, filename).split(sep).join(posix.sep)
  return include.some((selector) =>
    'files' in selector
      ? file !== null && selector.files.some((pattern) => posix.matchesGlob(file, pattern))
      : isPublishableLibrary(projectRoot)
  )
}
