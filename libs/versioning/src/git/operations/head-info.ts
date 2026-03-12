import type { GitCommitOptions } from './commit'
import { execSync } from 'node:child_process'
import { DEFAULT_COMMIT_OPTIONS } from './commit'

/**
 * Gets the current HEAD commit hash.
 *
 * @param options - Git operation configuration
 * @returns HEAD commit hash or null
 *
 * @example
 * const head = getHead()
 */
export function getHead(options: GitCommitOptions = {}): string | null {
  const opts = { ...DEFAULT_COMMIT_OPTIONS, ...options }

  try {
    return execSync('git rev-parse HEAD', {
      encoding: 'utf-8',
      cwd: opts.cwd,
      timeout: opts.timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
  } catch {
    return null
  }
}

/**
 * Gets the current branch name.
 *
 * @param options - Configuration for the operation
 * @returns Branch name or null if detached
 *
 * @example
 * const branch = getCurrentBranch()
 */
export function getCurrentBranch(options: GitCommitOptions = {}): string | null {
  const opts = { ...DEFAULT_COMMIT_OPTIONS, ...options }

  try {
    const result = execSync('git symbolic-ref --short HEAD', {
      encoding: 'utf-8',
      cwd: opts.cwd,
      timeout: opts.timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
    return result || null
  } catch {
    // Detached HEAD or not a git repo
    return null
  }
}

/**
 * Checks if there are untracked files.
 *
 * @param options - Configuration for the operation
 * @returns True if there are untracked files in the working directory
 */
export function hasUntrackedFiles(options: GitCommitOptions = {}): boolean {
  const opts = { ...DEFAULT_COMMIT_OPTIONS, ...options }

  try {
    const result = execSync('git ls-files --others --exclude-standard', {
      encoding: 'utf-8',
      cwd: opts.cwd,
      timeout: opts.timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
    return result.length > 0
  } catch {
    return false
  }
}
