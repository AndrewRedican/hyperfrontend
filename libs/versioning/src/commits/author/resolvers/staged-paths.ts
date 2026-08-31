import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
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
 * Default staged-paths provider. Resolves the repository root via
 * `git rev-parse --show-toplevel`, reads `git diff --cached --name-only -z`,
 * and returns each staged path as an absolute path anchored at that root.
 *
 * Git emits staged paths relative to the repository root no matter which
 * directory the command runs from, so anchoring here keeps downstream
 * project-root discovery correct when the session cwd is a subdirectory.
 *
 * @param options - Resolver options (cwd, optional timeout)
 * @returns Absolute staged file paths
 *
 * @example Reading the current staging area from a subdirectory
 * ```typescript
 * getStagedPaths({ cwd: '/repo/apps/demo' })
 * // => ['/repo/libs/versioning/src/commits/author/index.ts']
 * ```
 */
export function getStagedPaths(options: StagedPathsOptions): readonly string[] {
  try {
    const repoRoot = runGit(['rev-parse', '--show-toplevel'], options).trim()
    const stdout = runGit(['diff', '--cached', '--name-only', '-z'], options)
    return splitOnNull(stdout).map((path) => join(repoRoot, path))
  } catch (error) {
    if (error instanceof Error) {
      throw createError(`Failed to read staged paths: ${error.message}`)
    }
    throw error
  }
}

/**
 * Runs a git subcommand with the provider's cwd and timeout applied.
 *
 * @param args - Git arguments after the binary name
 * @param options - Resolver options supplying cwd and timeout
 * @returns Raw stdout of the git invocation
 */
function runGit(args: readonly string[], options: StagedPathsOptions): string {
  return execFileSync('git', args as string[], {
    encoding: 'utf-8',
    cwd: options.cwd,
    timeout: options.timeout ?? DEFAULT_TIMEOUT,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
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
