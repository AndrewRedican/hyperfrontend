import type { GitCommitOptions } from './commit'
import { execFileSync } from 'node:child_process'
import { DEFAULT_COMMIT_OPTIONS, escapeFilePath } from './commit'

/**
 * Options for discarding changes.
 */
export interface DiscardChangesOptions extends GitCommitOptions {
  /**
   * Files or directories to discard. If empty/undefined, discards ALL changes.
   * Paths are relative to the working directory.
   */
  readonly files?: readonly string[]
}

/**
 * Options for staging files.
 */
export interface StageOptions extends GitCommitOptions {
  /** Stage all changes (including untracked) */
  readonly all?: boolean

  /** Update tracked files only */
  readonly update?: boolean

  /** Force add (ignore gitignore) */
  readonly force?: boolean
}

/**
 * Stages files for commit.
 *
 * @param files - Array of file paths relative to working directory
 * @param options - Configuration for the staging operation
 * @returns True if staging succeeded
 *
 * @example Stage files for commit
 * stage(['package.json', 'CHANGELOG.md'])
 * stage(['.'], { all: true })
 */
export function stage(files: readonly string[], options: StageOptions = {}): boolean {
  const opts = { ...DEFAULT_COMMIT_OPTIONS, ...options }
  const args: string[] = ['add']

  if (opts.all) {
    args.push('-A')
  } else if (opts.update) {
    args.push('-u')
  }

  if (opts.force) {
    args.push('-f')
  }

  for (const file of files) {
    args.push(escapeFilePath(file))
  }

  try {
    execFileSync('git', args, {
      encoding: 'utf-8',
      cwd: opts.cwd,
      timeout: opts.timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return true
  } catch {
    return false
  }
}

/**
 * Unstages files.
 *
 * @param files - Array of file paths to remove from staging area
 * @param options - Configuration for the unstage operation
 * @returns True if unstaging succeeded
 *
 * @example Unstage files from the index
 * unstage(['package.json'])
 */
export function unstage(files: readonly string[], options: GitCommitOptions = {}): boolean {
  const opts = { ...DEFAULT_COMMIT_OPTIONS, ...options }
  const args: string[] = ['reset', 'HEAD', '--']

  for (const file of files) {
    args.push(escapeFilePath(file))
  }

  try {
    execFileSync('git', args, {
      encoding: 'utf-8',
      cwd: opts.cwd,
      timeout: opts.timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return true
  } catch {
    return false
  }
}

/**
 * Stages all changes (tracked and untracked).
 *
 * @param options - Configuration for the staging operation
 * @returns True if all changes were successfully added to the index
 *
 * @example Stage all tracked and untracked changes
 * stageAll() // stages all tracked and untracked changes
 */
export function stageAll(options: GitCommitOptions = {}): boolean {
  return stage(['.'], { ...options, all: true })
}

/**
 * Checks if there are staged changes.
 *
 * @param options - Configuration for the operation
 * @returns True if there are staged changes ready to commit
 *
 * @example Check for staged changes before committing
 * if (hasStagedChanges()) { createCommit('...') }
 */
export function hasStagedChanges(options: GitCommitOptions = {}): boolean {
  const opts = { ...DEFAULT_COMMIT_OPTIONS, ...options }

  try {
    execFileSync('git', ['diff', '--cached', '--quiet'], {
      encoding: 'utf-8',
      cwd: opts.cwd,
      timeout: opts.timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return false
  } catch {
    return true
  }
}

/**
 * Checks if there are unstaged changes (working tree dirty).
 *
 * @param options - Configuration for the operation
 * @returns True if there are unstaged changes in the working tree
 *
 * @example Check for unstaged changes before staging
 * if (hasUnstagedChanges()) { stage(['.']) }
 */
export function hasUnstagedChanges(options: GitCommitOptions = {}): boolean {
  const opts = { ...DEFAULT_COMMIT_OPTIONS, ...options }

  try {
    execFileSync('git', ['diff', '--quiet'], {
      encoding: 'utf-8',
      cwd: opts.cwd,
      timeout: opts.timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return false
  } catch {
    return true
  }
}

/**
 * Discards uncommitted changes to tracked files.
 *
 * Uses `git checkout -- <files>` to restore files from HEAD.
 * Returns true if successful, false otherwise (silent failure pattern).
 *
 * **Warning:** Destructive operation — discarded changes cannot be recovered.
 *
 * @param options - Configuration including optional file list
 * @returns True if discard succeeded
 *
 * @example Discard changes in tracked files
 * // Discard all changes
 * discardChanges()
 *
 * // Discard specific files
 * discardChanges({ files: ['package.json', 'CHANGELOG.md'] })
 *
 * @example Typical rollback pattern
 * // Typical rollback pattern
 * if (hasUnstagedChanges()) {
 *   discardChanges()
 * }
 * if (hasStagedChanges()) {
 *   unstage(['.'])
 * }
 */
export function discardChanges(options: DiscardChangesOptions = {}): boolean {
  const opts = { ...DEFAULT_COMMIT_OPTIONS, ...options }

  const args: string[] = ['checkout', '--']

  if (opts.files && opts.files.length > 0) {
    for (const file of opts.files) {
      args.push(escapeFilePath(file))
    }
  } else {
    args.push('.')
  }

  try {
    execFileSync('git', args, {
      encoding: 'utf-8',
      cwd: opts.cwd,
      timeout: opts.timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return true
  } catch {
    return false
  }
}

/**
 * Discards all uncommitted changes and unstages all files.
 *
 * Combines `discardChanges()` + `unstage(['.'])` for complete working tree reset.
 *
 * **Warning:** Destructive operation — discarded changes cannot be recovered.
 *
 * @param options - Configuration for the operation
 * @returns True if both operations succeeded
 *
 * @example Reset working directory to match HEAD
 * ```typescript
 * // Reset working directory to match HEAD
 * if (discardAllChanges()) {
 *   console.log('Working tree reset to HEAD')
 * }
 * ```
 */
export function discardAllChanges(options: GitCommitOptions = {}): boolean {
  const discarded = discardChanges(options)
  const unstaged = unstage(['.'], options)
  return discarded && unstaged
}
