import type { GitCommit } from '../models/commit'
import { execFileSync } from 'node:child_process'
import { escapeGitRef } from './log'
import { getCommit } from './log'

/**
 * File change status codes matching git conventions.
 */
export type FileChangeStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'copied'

/**
 * A file changed in a commit or between refs.
 */
export interface FileChange {
  /** File path relative to repository root */
  readonly path: string

  /** Type of change */
  readonly status: FileChangeStatus

  /** Original path for renames/copies */
  readonly oldPath?: string
}

/**
 * Options for diff-based queries.
 */
export interface DiffOptions {
  /** Working directory (defaults to cwd) */
  readonly cwd?: string

  /** Timeout in milliseconds */
  readonly timeout?: number
}

/**
 * A git commit with file change information.
 */
export interface GitCommitWithFiles extends GitCommit {
  /** Files changed in this commit */
  readonly files: readonly FileChange[]
}

/**
 * Default diff options.
 */
export const DEFAULT_DIFF_OPTIONS: Required<Omit<DiffOptions, 'cwd'>> = {
  timeout: 30000,
}

/** Options for commit file queries with optional working directory. */
type CommitFilesOptions = Required<Omit<DiffOptions, 'cwd'>> & Pick<DiffOptions, 'cwd'>

/**
 * Gets files changed between two git refs.
 *
 * Uses `git diff --name-only base...head` which computes the merge-base
 * internally, giving files changed in `head` since diverging from `base`.
 *
 * @param base - Base reference (e.g., 'origin/main', 'v1.0.0')
 * @param head - Head reference (defaults to 'HEAD')
 * @param options - Additional options
 * @returns Deduplicated list of changed file paths (relative to repo root)
 *
 * @example
 * // Files changed since diverging from main
 * const files = getChangedFilesBetween('origin/main')
 *
 * // Files changed between two tags
 * const files = getChangedFilesBetween('v1.0.0', 'v2.0.0')
 */
export function getChangedFilesBetween(base: string, head = 'HEAD', options: DiffOptions = {}): readonly string[] {
  const opts = { ...DEFAULT_DIFF_OPTIONS, ...options }
  const safeBase = escapeGitRef(base)
  const safeHead = escapeGitRef(head)

  try {
    const output = execFileSync('git', ['diff', '--name-only', `${safeBase}...${safeHead}`], {
      encoding: 'utf-8',
      cwd: opts.cwd,
      timeout: opts.timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 50 * 1024 * 1024,
    })

    return parseFileList(output)
  } catch {
    return []
  }
}

/**
 * Gets files changed between two refs with status information.
 *
 * @param base - Base reference
 * @param head - Head reference (defaults to 'HEAD')
 * @param options - Additional options
 * @returns Array of file changes with status
 *
 * @example
 * const changes = getChangedFilesBetweenWithStatus('v1.0.0', 'v2.0.0')
 * const added = changes.filter(c => c.status === 'added')
 */
export function getChangedFilesBetweenWithStatus(base: string, head = 'HEAD', options: DiffOptions = {}): readonly FileChange[] {
  const opts = { ...DEFAULT_DIFF_OPTIONS, ...options }
  const safeBase = escapeGitRef(base)
  const safeHead = escapeGitRef(head)

  try {
    const output = execFileSync('git', ['diff', '--name-status', '-M', `${safeBase}...${safeHead}`], {
      encoding: 'utf-8',
      cwd: opts.cwd,
      timeout: opts.timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 50 * 1024 * 1024,
    })

    return parseNameStatusOutput(output)
  } catch {
    return []
  }
}

/**
 * Gets a commit with its changed files.
 *
 * Uses `git diff-tree` to retrieve file changes for a single commit.
 * More efficient than fetching files for all commits when only
 * specific commits need file attribution.
 *
 * @param hash - Commit hash (full or abbreviated)
 * @param options - Additional options
 * @returns Commit with files, or null if not found
 *
 * @example
 * const commit = getCommitWithFiles('abc123')
 * if (commit) {
 *   console.log(`${commit.subject} touched ${commit.files.length} files`)
 * }
 */
export function getCommitWithFiles(hash: string, options: DiffOptions = {}): GitCommitWithFiles | null {
  const opts = { ...DEFAULT_DIFF_OPTIONS, ...options }

  const commit = getCommit(hash, { cwd: opts.cwd, timeout: opts.timeout })
  if (!commit) {
    return null
  }

  const files = getCommitFiles(hash, opts)

  return {
    ...commit,
    files,
  }
}

/**
 * Gets the files changed in a specific commit.
 *
 * @param hash - Commit hash (full or abbreviated)
 * @param options - Configuration including timeout and working directory
 * @returns Array of file changes
 */
function getCommitFiles(hash: string, options: CommitFilesOptions): readonly FileChange[] {
  const safeHash = escapeGitRef(hash)

  try {
    const output = execFileSync('git', ['diff-tree', '--no-commit-id', '-r', '--name-status', '-M', safeHash], {
      encoding: 'utf-8',
      cwd: options.cwd,
      timeout: options.timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024,
    })

    return parseNameStatusOutput(output)
  } catch {
    return []
  }
}

/**
 * Parses file list output (from --name-only).
 *
 * @param output - Raw git output
 * @returns Array of file paths
 */
function parseFileList(output: string): readonly string[] {
  const trimmed = output.trim()
  if (!trimmed) {
    return []
  }

  const files: string[] = []
  let current = ''

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i]
    if (char === '\n') {
      const file = current.trim()
      if (file) {
        files.push(file)
      }
      current = ''
    } else {
      current += char
    }
  }

  const lastFile = current.trim()
  if (lastFile) {
    files.push(lastFile)
  }

  return files
}

/**
 * Parses name-status output (from --name-status).
 *
 * Format: <status>\t<path> or <status>\t<oldPath>\t<newPath> for renames
 *
 * @param output - Raw git output
 * @returns Array of file changes
 */
function parseNameStatusOutput(output: string): readonly FileChange[] {
  const trimmed = output.trim()
  if (!trimmed) {
    return []
  }

  const changes: FileChange[] = []
  const lines = splitLines(trimmed)

  for (const line of lines) {
    const change = parseNameStatusLine(line)
    if (change) {
      changes.push(change)
    }
  }

  return changes
}

/**
 * Parses a single name-status line.
 *
 * @param line - Single line from name-status output
 * @returns FileChange or null if line is invalid
 */
function parseNameStatusLine(line: string): FileChange | null {
  const trimmed = line.trim()
  if (!trimmed) {
    return null
  }

  const tabIndex = findChar(trimmed, '\t')
  if (tabIndex === -1) {
    return null
  }

  const statusCode = trimmed.slice(0, tabIndex)
  const pathPart = trimmed.slice(tabIndex + 1)

  const status = parseStatusCode(statusCode)
  if (!status) {
    return null
  }

  if (status === 'renamed' || status === 'copied') {
    const secondTabIndex = findChar(pathPart, '\t')
    if (secondTabIndex !== -1) {
      const oldPath = pathPart.slice(0, secondTabIndex)
      const newPath = pathPart.slice(secondTabIndex + 1)
      return {
        path: newPath,
        status,
        oldPath,
      }
    }
  }

  return {
    path: pathPart,
    status,
  }
}

/**
 * Parses a git status code to FileChangeStatus.
 *
 * @param code - Git status code (A, M, D, R, C, or with percentage for R/C)
 * @returns FileChangeStatus or null if unknown
 */
function parseStatusCode(code: string): FileChangeStatus | null {
  if (!code) {
    return null
  }

  const firstChar = code[0]

  if (firstChar === 'R') {
    return 'renamed'
  }
  if (firstChar === 'C') {
    return 'copied'
  }

  switch (firstChar) {
    case 'A':
      return 'added'
    case 'M':
      return 'modified'
    case 'D':
      return 'deleted'
    default:
      return null
  }
}

/**
 * Splits string into lines (no regex).
 *
 * @param str - String to split
 * @returns Array of lines
 */
function splitLines(str: string): string[] {
  const lines: string[] = []
  let current = ''

  for (let i = 0; i < str.length; i++) {
    const char = str[i]
    if (char === '\n') {
      lines.push(current)
      current = ''
    } else {
      current += char
    }
  }

  if (current) {
    lines.push(current)
  }

  return lines
}

/**
 * Finds character position (no regex).
 *
 * @param str - String to search
 * @param char - Character to find
 * @returns Position or -1 if not found
 */
function findChar(str: string, char: string): number {
  for (let i = 0; i < str.length; i++) {
    if (str[i] === char) {
      return i
    }
  }
  return -1
}
