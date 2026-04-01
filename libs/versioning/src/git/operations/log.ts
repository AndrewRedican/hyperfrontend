import type { GitCommit } from '../models/commit'
import { execFileSync } from 'node:child_process'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createGitCommit } from '../models/commit'

/**
 * Options for git log operations.
 */
export interface GitLogOptions {
  /** Maximum number of commits to retrieve */
  readonly maxCount?: number

  /** Starting commit reference (inclusive) */
  readonly from?: string

  /** Ending commit reference (exclusive) */
  readonly to?: string

  /** File path to filter commits by */
  readonly path?: string

  /** Author to filter by */
  readonly author?: string

  /** Include merge commits */
  readonly includeMerges?: boolean

  /** Working directory (defaults to cwd) */
  readonly cwd?: string

  /** Timeout in milliseconds */
  readonly timeout?: number
}

/**
 * Default log options.
 */
export const DEFAULT_LOG_OPTIONS: Required<Omit<GitLogOptions, 'from' | 'to' | 'path' | 'author' | 'cwd'>> = {
  maxCount: 100,
  includeMerges: true,
  timeout: 30000,
}

/**
 * Git log format string for structured output.
 * Uses ASCII delimiters that won't appear in commit messages.
 */
const LOG_FORMAT = ['%H', '%an', '%ae', '%aI', '%cn', '%ce', '%cI', '%s', '%b', '%P', '%D'].join('%x00')

/**
 * Record separator for commit entries.
 */
const RECORD_SEPARATOR = '\x1e'

/**
 * Gets the commit log from a git repository.
 *
 * @param options - Configuration for retrieving the commit log
 * @returns Array of GitCommit objects
 *
 * @example
 * const commits = getCommitLog({ maxCount: 10 })
 * const recentChanges = getCommitLog({ from: 'v1.0.0', to: 'HEAD' })
 */
export function getCommitLog(options: GitLogOptions = {}): readonly GitCommit[] {
  const opts = { ...DEFAULT_LOG_OPTIONS, ...options }

  const args: string[] = ['log', `--format=${RECORD_SEPARATOR}${LOG_FORMAT}`]

  if (opts.maxCount !== undefined && opts.maxCount > 0) {
    args.push(`-n${opts.maxCount}`)
  }

  if (!opts.includeMerges) {
    args.push('--no-merges')
  }

  if (opts.author) {
    const safeAuthor = escapeGitArg(opts.author)
    args.push(`--author=${safeAuthor}`)
  }

  if (opts.from && opts.to) {
    const safeFrom = escapeGitRef(opts.from)
    const safeTo = escapeGitRef(opts.to)
    args.push(`${safeFrom}..${safeTo}`)
  } else if (opts.from) {
    const safeFrom = escapeGitRef(opts.from)
    args.push(`${safeFrom}..HEAD`)
  } else if (opts.to) {
    const safeTo = escapeGitRef(opts.to)
    args.push(safeTo)
  }

  if (opts.path) {
    const safePath = escapeGitPath(opts.path)
    args.push('--', safePath)
  }

  try {
    const output = execFileSync('git', args, {
      encoding: 'utf-8',
      cwd: opts.cwd,
      timeout: opts.timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 50 * 1024 * 1024,
    })

    return parseCommitLog(output)
  } catch (error) {
    if (error instanceof Error && error.message.includes('does not have any commits')) {
      return []
    }
    throw error
  }
}

/**
 * Gets commits between two references.
 *
 * @param from - Starting reference (exclusive)
 * @param to - Ending reference (inclusive, default: HEAD)
 * @param options - Additional options
 * @returns Array of GitCommit objects
 *
 * @example
 * const commits = getCommitsBetween('v1.0.0', 'v1.1.0')
 */
export function getCommitsBetween(from: string, to = 'HEAD', options: Omit<GitLogOptions, 'from' | 'to'> = {}): readonly GitCommit[] {
  return getCommitLog({ ...options, from, to })
}

/**
 * Gets commits since a specific tag or reference.
 *
 * @param since - Reference to start from (exclusive)
 * @param options - Additional options
 * @returns Array of GitCommit objects
 *
 * @example
 * const commits = getCommitsSince('v1.0.0')
 */
export function getCommitsSince(since: string, options: Omit<GitLogOptions, 'from'> = {}): readonly GitCommit[] {
  return getCommitLog({ ...options, from: since })
}

/**
 * Gets a single commit by its hash.
 *
 * @param hash - Commit hash (full or short)
 * @param options - Additional options
 * @returns GitCommit or null if not found
 *
 * @example
 * const commit = getCommit('abc1234')
 */
export function getCommit(hash: string, options: Pick<GitLogOptions, 'cwd' | 'timeout'> = {}): GitCommit | null {
  const safeHash = escapeGitRef(hash)

  try {
    const commits = getCommitLog({
      ...options,
      to: safeHash,
      maxCount: 1,
    })
    return commits[0] ?? null
  } catch {
    return null
  }
}

/**
 * Checks if a commit exists in the repository.
 *
 * @param hash - Commit hash to check
 * @param options - Additional options
 * @returns True if commit exists
 */
export function commitExists(hash: string, options: Pick<GitLogOptions, 'cwd' | 'timeout'> = {}): boolean {
  const safeHash = escapeGitRef(hash)

  try {
    execFileSync('git', ['cat-file', '-t', safeHash], {
      encoding: 'utf-8',
      cwd: options.cwd,
      timeout: options.timeout ?? 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return true
  } catch {
    return false
  }
}

/**
 * Checks if a commit is reachable from HEAD (i.e., is an ancestor of HEAD).
 *
 * A commit may exist in the repository but be orphaned (not in current branch history).
 * This function verifies that the commit is actually in the history of the current HEAD.
 *
 * Common use cases:
 * - Verify an external commit reference before using it for range queries
 * - Detect if history was rewritten (rebase/force push) after a reference was recorded
 *
 * @param hash - Commit hash to check
 * @param options - Additional options
 * @returns True if the commit is an ancestor of HEAD
 *
 * @example
 * if (commitReachableFromHead(baseCommit)) {
 *   // Safe to use for commit range queries
 *   const commits = getCommitsSince(baseCommit)
 * } else {
 *   // Commit not in current history, need fallback strategy
 * }
 */
export function commitReachableFromHead(hash: string, options: Pick<GitLogOptions, 'cwd' | 'timeout'> = {}): boolean {
  const safeHash = escapeGitRef(hash)
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', safeHash, 'HEAD'], {
      encoding: 'utf-8',
      cwd: options.cwd,
      timeout: options.timeout ?? 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return true
  } catch {
    return false
  }
}

/**
 * Parses raw git log output into GitCommit objects.
 *
 * @param output - Raw git log output
 * @returns Array of GitCommit objects
 */
function parseCommitLog(output: string): GitCommit[] {
  const commits: GitCommit[] = []

  if (!output.trim()) {
    return commits
  }

  const records = splitByDelimiter(output, RECORD_SEPARATOR)

  for (const record of records) {
    const trimmed = record.trim()
    if (!trimmed) continue

    const fields = splitByDelimiter(trimmed, '\x00')

    if (fields.length < 10) continue

    const [hash, authorName, authorEmail, authorDate, committerName, committerEmail, commitDate, subject, body, parentsStr, refsStr] =
      fields

    const parents = parentsStr ? splitByDelimiter(parentsStr, ' ').filter((p) => p.trim()) : []

    const refs = parseRefs(refsStr || '')

    commits.push(
      createGitCommit({
        hash,
        authorName,
        authorEmail,
        authorDate,
        committerName,
        committerEmail,
        commitDate,
        subject,
        body: body || undefined,
        parents,
        refs,
      })
    )
  }

  return commits
}

/**
 * Parses ref string from git log.
 *
 * @param refsStr - Raw refs string from git log
 * @returns Array of ref names
 */
function parseRefs(refsStr: string): string[] {
  if (!refsStr.trim()) {
    return []
  }

  const refs: string[] = []
  const parts = splitByDelimiter(refsStr, ',')

  for (const part of parts) {
    let ref = part.trim()

    const arrowIndex = findSubstring(ref, ' -> ')
    if (arrowIndex !== -1) {
      refs.push('HEAD')
      ref = ref.slice(arrowIndex + 4)
    }

    if (startsWithPrefix(ref, 'tag: ')) {
      ref = ref.slice(5)
    }

    if (ref) {
      refs.push(ref)
    }
  }

  return refs
}

/**
 * Splits string by delimiter (no regex).
 *
 * @param str - String to split
 * @param delimiter - Delimiter to split by
 * @returns Array of parts
 */
function splitByDelimiter(str: string, delimiter: string): string[] {
  const parts: string[] = []
  let current = ''
  let i = 0

  while (i < str.length) {
    if (matchesAt(str, i, delimiter)) {
      parts.push(current)
      current = ''
      i += delimiter.length
    } else {
      current += str[i]
      i++
    }
  }

  parts.push(current)
  return parts
}

/**
 * Checks if string matches at position.
 *
 * @param str - String to check
 * @param pos - Position to check at
 * @param pattern - Pattern to match
 * @returns True if matches
 */
function matchesAt(str: string, pos: number, pattern: string): boolean {
  if (pos + pattern.length > str.length) return false

  for (let i = 0; i < pattern.length; i++) {
    if (str[pos + i] !== pattern[i]) return false
  }

  return true
}

/**
 * Finds substring position (no regex).
 *
 * @param str - String to search
 * @param pattern - Pattern to find
 * @returns Position or -1 if not found
 */
function findSubstring(str: string, pattern: string): number {
  for (let i = 0; i <= str.length - pattern.length; i++) {
    if (matchesAt(str, i, pattern)) {
      return i
    }
  }
  return -1
}

/**
 * Checks if string starts with prefix (no regex).
 *
 * @param str - String to check
 * @param prefix - Prefix to check for
 * @returns True if starts with prefix
 */
function startsWithPrefix(str: string, prefix: string): boolean {
  return matchesAt(str, 0, prefix)
}

/**
 * Maximum allowed git reference length.
 */
const MAX_REF_LENGTH = 256

/**
 * Escapes a git reference for safe use in shell commands.
 *
 * @param ref - Reference to escape
 * @returns Safe reference string
 * @throws {Error} If reference contains invalid characters
 */
export function escapeGitRef(ref: string): string {
  if (!ref || typeof ref !== 'string') {
    throw createError('Git reference is required')
  }

  if (ref.length > MAX_REF_LENGTH) {
    throw createError(`Git reference exceeds maximum length of ${MAX_REF_LENGTH}`)
  }

  const safe: string[] = []

  for (let i = 0; i < ref.length; i++) {
    const code = ref.charCodeAt(i)

    if (
      (code >= 97 && code <= 122) ||
      (code >= 65 && code <= 90) ||
      (code >= 48 && code <= 57) ||
      code === 47 ||
      code === 45 ||
      code === 95 ||
      code === 46 ||
      code === 126 ||
      code === 94 ||
      code === 64 ||
      code === 123 ||
      code === 125
    ) {
      safe.push(ref[i])
    } else {
      throw createError(`Invalid character in git reference at position ${i}: "${ref[i]}"`)
    }
  }

  return safe.join('')
}

/**
 * Maximum allowed git path length.
 */
const MAX_PATH_LENGTH = 4096

/**
 * Escapes a file path for safe use in git commands.
 *
 * @param path - Path to escape
 * @returns Safe path string
 * @throws {Error} If path contains invalid characters
 */
export function escapeGitPath(path: string): string {
  if (!path || typeof path !== 'string') {
    throw createError('Path is required')
  }

  if (path.length > MAX_PATH_LENGTH) {
    throw createError(`Path exceeds maximum length of ${MAX_PATH_LENGTH}`)
  }

  const safe: string[] = []

  for (let i = 0; i < path.length; i++) {
    const code = path.charCodeAt(i)

    if (
      (code >= 97 && code <= 122) ||
      (code >= 65 && code <= 90) ||
      (code >= 48 && code <= 57) ||
      code === 47 ||
      code === 92 ||
      code === 45 ||
      code === 95 ||
      code === 46 ||
      code === 32
    ) {
      safe.push(path[i])
    } else {
      throw createError(`Invalid character in path at position ${i}: "${path[i]}"`)
    }
  }

  return safe.join('')
}

/**
 * Maximum allowed argument length.
 */
const MAX_ARG_LENGTH = 1000

/**
 * Escapes a general git argument for safe use in shell commands.
 *
 * @param arg - Argument to escape
 * @returns Safe argument string
 * @throws {Error} If argument contains invalid characters
 */
export function escapeGitArg(arg: string): string {
  if (!arg || typeof arg !== 'string') {
    throw createError('Argument is required')
  }

  if (arg.length > MAX_ARG_LENGTH) {
    throw createError(`Argument exceeds maximum length of ${MAX_ARG_LENGTH}`)
  }

  const safe: string[] = []

  for (let i = 0; i < arg.length; i++) {
    const code = arg.charCodeAt(i)

    if (
      (code >= 97 && code <= 122) ||
      (code >= 65 && code <= 90) ||
      (code >= 48 && code <= 57) ||
      code === 32 ||
      code === 64 ||
      code === 46 ||
      code === 45 ||
      code === 95 ||
      code === 60 ||
      code === 62 ||
      code === 43
    ) {
      safe.push(arg[i])
    } else {
      throw createError(`Invalid character in argument at position ${i}: "${arg[i]}"`)
    }
  }

  return safe.join('')
}
