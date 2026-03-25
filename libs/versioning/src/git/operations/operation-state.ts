import type { GitCommitOptions } from './commit'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_COMMIT_OPTIONS } from './commit'

/**
 * Reasons why git may be in an unstable operation state.
 *
 * These correspond to state files that git creates during multi-step operations:
 *
 * - `'rebase-interactive'`: `.git/rebase-merge` exists (interactive rebase paused)
 * - `'rebase-apply'`: `.git/rebase-apply` exists (mailbox-based rebase or `git am`)
 * - `'merge-in-progress'`: `.git/MERGE_HEAD` exists (merge awaiting conflict resolution)
 */
export type GitOperationStateReason =
  | 'rebase-interactive' // .git/rebase-merge exists (interactive rebase)
  | 'rebase-apply' // .git/rebase-apply exists (am/apply rebase)
  | 'merge-in-progress' // .git/MERGE_HEAD exists

/**
 * Result of checking git's operation state.
 */
export interface GitOperationState {
  /** True if git is mid-operation (rebase, merge, etc.) */
  readonly inProgress: boolean

  /**
   * Which operation is in progress, if any.
   * Returns the first detected state (exit-early pattern).
   */
  readonly reason: GitOperationStateReason | null

  /**
   * Detailed state for each check performed.
   * Useful for diagnostics or when multiple states could theoretically overlap.
   */
  readonly details: {
    readonly rebaseMerge: boolean
    readonly rebaseApply: boolean
    readonly mergeHead: boolean
  }
}

/**
 * Options for operation state check.
 */
export type GitOperationStateOptions = GitCommitOptions

/**
 * Default options for operation state checks.
 */
export const DEFAULT_OPERATION_STATE_OPTIONS: Required<Omit<GitOperationStateOptions, 'cwd'>> = {
  timeout: DEFAULT_COMMIT_OPTIONS.timeout,
}

/**
 * Detects if git is mid-operation (rebase, merge, patch apply).
 *
 * Uses filesystem checks on `.git/` state files rather than git commands.
 * This is more reliable because file existence checks are atomic OS syscalls
 * that work even when the git index is corrupted or git commands would hang.
 *
 * Handles worktrees, submodules, and `$GIT_DIR` overrides via `git rev-parse --git-dir`.
 *
 * @param options - Configuration for the state check
 * @returns Operation state with reason if in progress
 *
 * @example
 * const state = getOperationState()
 * if (state.inProgress) {
 *   console.warn(`Cannot proceed: git ${state.reason} in progress`)
 * }
 */
export function getOperationState(options: GitOperationStateOptions = {}): GitOperationState {
  const opts = { ...DEFAULT_OPERATION_STATE_OPTIONS, ...options }

  try {
    // Get git directory (handles worktrees, submodules, GIT_DIR override)
    const gitDir = execFileSync('git', ['rev-parse', '--git-dir'], {
      cwd: opts.cwd,
      encoding: 'utf-8',
      timeout: opts.timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()

    const basePath = opts.cwd ?? process.cwd()
    const rebaseMerge = existsSync(join(basePath, gitDir, 'rebase-merge'))
    const rebaseApply = existsSync(join(basePath, gitDir, 'rebase-apply'))
    const mergeHead = existsSync(join(basePath, gitDir, 'MERGE_HEAD'))

    // Exit-early pattern: return first detected reason
    let reason: GitOperationStateReason | null = null
    if (rebaseMerge) reason = 'rebase-interactive'
    else if (rebaseApply) reason = 'rebase-apply'
    else if (mergeHead) reason = 'merge-in-progress'

    return {
      inProgress: reason !== null,
      reason,
      details: { rebaseMerge, rebaseApply, mergeHead },
    }
  } catch {
    // Not a repo or git unavailable — assume no operation in progress (non-blocking)
    return {
      inProgress: false,
      reason: null,
      details: { rebaseMerge: false, rebaseApply: false, mergeHead: false },
    }
  }
}

/**
 * Checks if git is in the middle of an incomplete operation.
 *
 * Convenience wrapper around `getOperationState()` for simple checks.
 * Use `getOperationState()` directly when you need to know *which*
 * operation is in progress.
 *
 * @param options - Configuration for the state check
 * @returns True if rebase, merge, or other operation is incomplete
 *
 * @example
 * if (isOperationInProgress()) {
 *   throw new Error('Complete or abort the current git operation first')
 * }
 */
export function isOperationInProgress(options: GitOperationStateOptions = {}): boolean {
  return getOperationState(options).inProgress
}
