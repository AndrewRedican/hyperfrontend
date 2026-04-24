import { execFileSync } from 'node:child_process'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/** Options accepted by the default staged-paths provider. */
export interface StagedPathsOptions {
  /** Working directory used as the git command cwd */
  readonly cwd: string

  /** Timeout in milliseconds (default: 30000) */
  readonly timeout?: number
}

const DEFAULT_TIMEOUT = 30000

/**
 * Default staged-paths provider. Shells out to
 * `git diff --cached --name-only -z`, splits on NUL, and filters out the
 * trailing empty entry. Returns paths relative to the git repository root
 * (same as git's own output).
 *
 * @param options - Resolver options (cwd, optional timeout)
 * @returns Staged file paths as emitted by git
 *
 * @example Reading the current staging area
 * ```typescript
 * getStagedPaths({ cwd: '/repo' })
 * // => ['libs/versioning/src/commits/author/index.ts']
 * ```
 */
export function getStagedPaths(options: StagedPathsOptions): readonly string[] {
  try {
    const stdout = execFileSync('git', ['diff', '--cached', '--name-only', '-z'], {
      encoding: 'utf-8',
      cwd: options.cwd,
      timeout: options.timeout ?? DEFAULT_TIMEOUT,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return splitOnNull(stdout)
  } catch (error) {
    if (error instanceof Error) {
      throw createError(`Failed to read staged paths: ${error.message}`)
    }
    throw error
  }
}

/**
 * Splits the `-z`-terminated git output into individual path entries, dropping
 * empty strings (notably the trailing one after the last NUL).
 *
 * @param output - Raw `-z`-separated git output
 * @returns Path entries in input order
 */
function splitOnNull(output: string): readonly string[] {
  const result: string[] = []
  let start = 0
  for (let i = 0; i < output.length; i++) {
    if (output.charCodeAt(i) === 0) {
      if (i > start) {
        result.push(output.slice(start, i))
      }
      start = i + 1
    }
  }
  if (start < output.length) {
    result.push(output.slice(start))
  }
  return result
}
