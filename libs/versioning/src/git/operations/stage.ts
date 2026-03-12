import type { GitCommitOptions } from './commit'
import { execSync } from 'node:child_process'
import { DEFAULT_COMMIT_OPTIONS, escapeFilePath } from './commit'

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
 * @example
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

  // Add files
  for (const file of files) {
    args.push(escapeFilePath(file))
  }

  try {
    execSync(`git ${args.join(' ')}`, {
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
 * @example
 * unstage(['package.json'])
 */
export function unstage(files: readonly string[], options: GitCommitOptions = {}): boolean {
  const opts = { ...DEFAULT_COMMIT_OPTIONS, ...options }
  const args: string[] = ['reset', 'HEAD', '--']

  for (const file of files) {
    args.push(escapeFilePath(file))
  }

  try {
    execSync(`git ${args.join(' ')}`, {
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
 * @example
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
 * @example
 * if (hasStagedChanges()) { createCommit('...') }
 */
export function hasStagedChanges(options: GitCommitOptions = {}): boolean {
  const opts = { ...DEFAULT_COMMIT_OPTIONS, ...options }

  try {
    execSync('git diff --cached --quiet', {
      encoding: 'utf-8',
      cwd: opts.cwd,
      timeout: opts.timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    // Exit code 0 means no changes
    return false
  } catch {
    // Exit code 1 means there are changes
    return true
  }
}

/**
 * Checks if there are unstaged changes (working tree dirty).
 *
 * @param options - Configuration for the operation
 * @returns True if there are unstaged changes in the working tree
 *
 * @example
 * if (hasUnstagedChanges()) { stage(['.']) }
 */
export function hasUnstagedChanges(options: GitCommitOptions = {}): boolean {
  const opts = { ...DEFAULT_COMMIT_OPTIONS, ...options }

  try {
    execSync('git diff --quiet', {
      encoding: 'utf-8',
      cwd: opts.cwd,
      timeout: opts.timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    // Exit code 0 means no changes
    return false
  } catch {
    // Exit code 1 means there are changes
    return true
  }
}
