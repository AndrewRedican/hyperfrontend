import { execFileSync } from 'node:child_process'
import { parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'

/** Ahead/behind count for branch tracking. */
interface AheadBehind {
  /** Commits ahead of tracking branch. */
  ahead: number
  /** Commits behind tracking branch. */
  behind: number
}

/**
 * Options for status operations.
 */
export interface GitStatusOptions {
  /** Working directory (defaults to cwd) */
  readonly cwd?: string

  /** Timeout in milliseconds */
  readonly timeout?: number
}

/**
 * File status in a git repository.
 */
export type FileStatus = 'modified' | 'added' | 'deleted' | 'renamed' | 'copied' | 'untracked' | 'ignored' | 'unmerged'

/**
 * Detailed file status.
 */
export interface FileStatusEntry {
  /** File path */
  readonly path: string

  /** Index (staging area) status */
  readonly indexStatus: FileStatus | null

  /** Working tree status */
  readonly workTreeStatus: FileStatus | null

  /** Original path for renamed/copied files */
  readonly origPath?: string
}

/**
 * Repository status summary.
 */
export interface RepositoryStatus {
  /** Current branch name */
  readonly branch: string | null

  /** Whether HEAD is detached */
  readonly detached: boolean

  /** Upstream branch (if tracking) */
  readonly upstream?: string

  /** Commits ahead of upstream */
  readonly ahead: number

  /** Commits behind upstream */
  readonly behind: number

  /** Staged files */
  readonly staged: readonly FileStatusEntry[]

  /** Modified files (unstaged) */
  readonly modified: readonly FileStatusEntry[]

  /** Untracked files */
  readonly untracked: readonly string[]

  /** Whether working tree is clean */
  readonly clean: boolean

  /** Whether there are merge conflicts */
  readonly hasConflicts: boolean
}

/**
 * Default status options.
 */
export const DEFAULT_STATUS_OPTIONS: Required<Omit<GitStatusOptions, 'cwd'>> = {
  timeout: 10000,
}

/**
 * Gets the full repository status.
 *
 * @param options - Configuration for the status query
 * @returns Comprehensive repository status information
 *
 * @example
 * const status = getStatus()
 * if (!status.clean) {
 *   console.log('Working tree has changes')
 * }
 */
export function getStatus(options: GitStatusOptions = {}): RepositoryStatus {
  const opts = { ...DEFAULT_STATUS_OPTIONS, ...options }

  const output = execFileSync('git', ['status', '--porcelain=v2', '--branch'], {
    encoding: 'utf-8',
    cwd: opts.cwd,
    timeout: opts.timeout,
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  return parseStatus(output)
}

/**
 * Parses git status porcelain v2 output.
 *
 * @param output - Raw status output
 * @returns Parsed status
 */
function parseStatus(output: string): RepositoryStatus {
  const lines = output.split('\n')

  let branch: string | null = null
  let detached = false
  let upstream: string | undefined
  let ahead = 0
  let behind = 0

  const staged: FileStatusEntry[] = []
  const modified: FileStatusEntry[] = []
  const untracked: string[] = []
  let hasConflicts = false

  for (const line of lines) {
    if (!line) continue

    if (startsWithPrefix(line, '# branch.head ')) {
      const branchName = line.slice(14)
      if (branchName === '(detached)') {
        detached = true
      } else {
        branch = branchName
      }
    } else if (startsWithPrefix(line, '# branch.upstream ')) {
      upstream = line.slice(18)
    } else if (startsWithPrefix(line, '# branch.ab ')) {
      const ab = parseAheadBehind(line.slice(12))
      ahead = ab.ahead
      behind = ab.behind
    } else if (line[0] === '1') {
      const entry = parseChangedEntry(line)
      if (entry) {
        if (entry.indexStatus) {
          staged.push(entry)
        }
        if (entry.workTreeStatus && entry.workTreeStatus !== 'untracked') {
          modified.push(entry)
        }
      }
    } else if (line[0] === '2') {
      const entry = parseRenamedEntry(line)
      if (entry) {
        if (entry.indexStatus) {
          staged.push(entry)
        }
        if (entry.workTreeStatus) {
          modified.push(entry)
        }
      }
    } else if (line[0] === 'u') {
      hasConflicts = true
      const entry = parseUnmergedEntry(line)
      if (entry) {
        staged.push(entry)
      }
    } else if (line[0] === '?') {
      const path = line.slice(2)
      untracked.push(path)
    }
  }

  const clean = staged.length === 0 && modified.length === 0 && untracked.length === 0 && !hasConflicts

  return {
    branch,
    detached,
    upstream,
    ahead,
    behind,
    staged,
    modified,
    untracked,
    clean,
    hasConflicts,
  }
}

/**
 * Parses ahead/behind string.
 *
 * @param str - String like "+5 -2"
 * @returns Parsed values
 */
function parseAheadBehind(str: string): AheadBehind {
  let ahead = 0
  let behind = 0

  const parts = str.split(' ')
  for (const part of parts) {
    if (part[0] === '+') {
      ahead = parseInt(part.slice(1), 10) || 0
    } else if (part[0] === '-') {
      behind = parseInt(part.slice(1), 10) || 0
    }
  }

  return { ahead, behind }
}

/**
 * Parses a changed entry line.
 *
 * @param line - Status line starting with '1'
 * @returns Parsed entry or null
 */
function parseChangedEntry(line: string): FileStatusEntry | null {
  const parts = line.split(' ')
  if (parts.length < 9) return null

  const xy = parts[1]
  const path = parts.slice(8).join(' ')

  const indexStatus = statusFromChar(xy[0])
  const workTreeStatus = statusFromChar(xy[1])

  return {
    path,
    indexStatus,
    workTreeStatus,
  }
}

/**
 * Parses a renamed entry line.
 *
 * @param line - Status line starting with '2'
 * @returns Parsed entry or null
 */
function parseRenamedEntry(line: string): FileStatusEntry | null {
  const parts = line.split(' ')
  if (parts.length < 10) return null

  const xy = parts[1]
  const pathPart = parts.slice(9).join(' ')

  const tabIndex = pathPart.indexOf('\t')
  const path = tabIndex >= 0 ? pathPart.slice(0, tabIndex) : pathPart
  const origPath = tabIndex >= 0 ? pathPart.slice(tabIndex + 1) : undefined

  const indexStatus = statusFromChar(xy[0])
  const workTreeStatus = statusFromChar(xy[1])

  return {
    path,
    indexStatus,
    workTreeStatus,
    origPath,
  }
}

/**
 * Parses an unmerged entry line.
 *
 * @param line - Status line starting with 'u'
 * @returns Parsed entry or null
 */
function parseUnmergedEntry(line: string): FileStatusEntry | null {
  const parts = line.split(' ')
  if (parts.length < 11) return null

  const path = parts.slice(10).join(' ')

  return {
    path,
    indexStatus: 'unmerged',
    workTreeStatus: 'unmerged',
  }
}

/**
 * Converts status character to FileStatus.
 *
 * @param char - Status character
 * @returns FileStatus or null
 */
function statusFromChar(char: string): FileStatus | null {
  switch (char) {
    case 'M':
      return 'modified'
    case 'T':
      return 'modified'
    case 'A':
      return 'added'
    case 'D':
      return 'deleted'
    case 'R':
      return 'renamed'
    case 'C':
      return 'copied'
    case 'U':
      return 'unmerged'
    case '?':
      return 'untracked'
    case '!':
      return 'ignored'
    case '.':
      return null
    default:
      return null
  }
}

/**
 * Checks if string starts with prefix (no regex).
 *
 * @param str - The string to check
 * @param prefix - The prefix to look for
 * @returns True if str starts with the given prefix
 */
function startsWithPrefix(str: string, prefix: string): boolean {
  if (prefix.length > str.length) return false
  for (let i = 0; i < prefix.length; i++) {
    if (str[i] !== prefix[i]) return false
  }
  return true
}

/**
 * Checks if the working tree is clean (no changes).
 *
 * @param options - Configuration for the status check
 * @returns True if working tree is clean with no uncommitted changes
 *
 * @example
 * if (!isClean()) {
 *   throw new Error('Working tree has changes')
 * }
 */
export function isClean(options: GitStatusOptions = {}): boolean {
  const status = getStatus(options)
  return status.clean
}

/**
 * Checks if the directory is a git repository.
 *
 * @param options - Status options
 * @returns True if in a git repository
 *
 * @example
 * if (!isGitRepository()) {
 *   throw new Error('Not a git repository')
 * }
 */
export function isGitRepository(options: GitStatusOptions = {}): boolean {
  const opts = { ...DEFAULT_STATUS_OPTIONS, ...options }

  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
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
 * Gets the repository root directory.
 *
 * @param options - Status options
 * @returns Root directory path or null
 *
 * @example
 * const root = getRepositoryRoot()
 */
export function getRepositoryRoot(options: GitStatusOptions = {}): string | null {
  const opts = { ...DEFAULT_STATUS_OPTIONS, ...options }

  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
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
 * Gets the current commit hash (HEAD).
 *
 * @param options - Status options
 * @returns Commit hash or null
 *
 * @example
 * ```typescript
 * const hash = getHeadHash()
 * // => 'abc123def456789012345678901234567890abcd'
 * ```
 */
export function getHeadHash(options: GitStatusOptions = {}): string | null {
  const opts = { ...DEFAULT_STATUS_OPTIONS, ...options }

  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
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
 * Gets the short current commit hash.
 *
 * @param options - Status options
 * @returns Short hash or null
 *
 * @example
 * ```typescript
 * const shortHash = getHeadShortHash()
 * // => 'abc123d'
 * ```
 */
export function getHeadShortHash(options: GitStatusOptions = {}): string | null {
  const opts = { ...DEFAULT_STATUS_OPTIONS, ...options }

  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
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
 * Checks if there are merge conflicts.
 *
 * @param options - Status options
 * @returns True if there are conflicts
 *
 * @example
 * ```typescript
 * if (hasConflicts()) {
 *   console.log('Resolve merge conflicts before continuing')
 * }
 * ```
 */
export function hasConflicts(options: GitStatusOptions = {}): boolean {
  const status = getStatus(options)
  return status.hasConflicts
}

/**
 * Gets the number of commits ahead of upstream.
 *
 * @param options - Status options
 * @returns Number of commits ahead
 *
 * @example
 * ```typescript
 * const ahead = getAheadCount()
 * console.log(`${ahead} commits to push`)
 * ```
 */
export function getAheadCount(options: GitStatusOptions = {}): number {
  const status = getStatus(options)
  return status.ahead
}

/**
 * Gets the number of commits behind upstream.
 *
 * @param options - Status options
 * @returns Number of commits behind
 *
 * @example
 * ```typescript
 * const behind = getBehindCount()
 * console.log(`${behind} commits to pull`)
 * ```
 */
export function getBehindCount(options: GitStatusOptions = {}): number {
  const status = getStatus(options)
  return status.behind
}

/**
 * Checks if the repository needs to be pushed.
 *
 * @param options - Status options
 * @returns True if there are unpushed commits
 *
 * @example
 * ```typescript
 * if (needsPush()) {
 *   console.log('Local commits need to be pushed')
 * }
 * ```
 */
export function needsPush(options: GitStatusOptions = {}): boolean {
  return getAheadCount(options) > 0
}

/**
 * Checks if the repository needs to be pulled.
 *
 * @param options - Status options
 * @returns True if there are commits to pull
 *
 * @example
 * ```typescript
 * if (needsPull()) {
 *   console.log('Remote commits need to be pulled')
 * }
 * ```
 */
export function needsPull(options: GitStatusOptions = {}): boolean {
  return getBehindCount(options) > 0
}

/**
 * Gets list of staged file paths.
 *
 * @param options - Status options
 * @returns Array of staged file paths
 *
 * @example
 * ```typescript
 * const staged = getStagedFiles()
 * // => ['src/index.ts', 'package.json']
 * ```
 */
export function getStagedFiles(options: GitStatusOptions = {}): readonly string[] {
  const status = getStatus(options)
  return status.staged.map((e) => e.path)
}

/**
 * Gets list of modified file paths (unstaged).
 *
 * @param options - Status options
 * @returns Array of modified file paths
 *
 * @example
 * ```typescript
 * const modified = getModifiedFiles()
 * // => ['src/utils.ts', 'README.md']
 * ```
 */
export function getModifiedFiles(options: GitStatusOptions = {}): readonly string[] {
  const status = getStatus(options)
  return status.modified.map((e) => e.path)
}

/**
 * Gets list of untracked file paths.
 *
 * @param options - Status options
 * @returns Array of untracked file paths
 *
 * @example
 * ```typescript
 * const untracked = getUntrackedFiles()
 * // => ['new-file.ts', 'temp.log']
 * ```
 */
export function getUntrackedFiles(options: GitStatusOptions = {}): readonly string[] {
  const status = getStatus(options)
  return status.untracked
}
