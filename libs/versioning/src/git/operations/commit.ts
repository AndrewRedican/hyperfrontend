import type { GitCommit } from '../models/commit'
import { execSync } from 'node:child_process'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { getCommit } from './log'
import { escapeGitMessage } from './manage-tags'

/**
 * Options for commit operations.
 */
export interface GitCommitOptions {
  /** Working directory (defaults to cwd) */
  readonly cwd?: string

  /** Timeout in milliseconds */
  readonly timeout?: number
}

/**
 * Options for creating a commit.
 */
export interface CreateCommitOptions extends GitCommitOptions {
  /** Commit message body (separate from subject) */
  readonly body?: string

  /** Allow empty commit (no changes) */
  readonly allowEmpty?: boolean

  /** Amend the last commit */
  readonly amend?: boolean

  /** Keep the existing commit message when amending (requires amend: true) */
  readonly noEdit?: boolean

  /** Sign the commit with GPG */
  readonly sign?: boolean

  /** Don't run pre-commit hooks */
  readonly noVerify?: boolean

  /** Author (format: "Name <email>") */
  readonly author?: string

  /** Specific files to commit (instead of all staged) */
  readonly files?: readonly string[]
}

/**
 * Default commit options.
 */
export const DEFAULT_COMMIT_OPTIONS: Required<Omit<GitCommitOptions, 'cwd'>> = {
  timeout: 30000,
}

/**
 * Creates a new commit.
 *
 * @param message - Commit message (subject line)
 * @param options - Create options
 * @returns Created GitCommit
 *
 * @example
 * const commit = createCommit('feat: add new feature')
 * const commit = createCommit('fix: resolve bug', { body: 'Detailed description' })
 */
export function commit(message: string, options: CreateCommitOptions = {}): GitCommit {
  const opts = { ...DEFAULT_COMMIT_OPTIONS, ...options }

  // noEdit is only valid when amending - reuse existing commit message
  const isNoEditAmend = opts.amend && opts.noEdit

  if (!isNoEditAmend && (!message || typeof message !== 'string')) {
    throw createError('Commit message is required')
  }

  const args: string[] = ['commit']

  if (isNoEditAmend) {
    // Amend without changing the message
    args.push('--amend', '--no-edit')
  } else {
    const safeMessage = escapeGitMessage(message)

    // Build message with optional body
    let fullMessage = safeMessage
    if (opts.body) {
      const safeBody = escapeGitMessage(opts.body)
      fullMessage = `${safeMessage}\n\n${safeBody}`
    }

    args.push('-m', `"${fullMessage}"`)

    if (opts.amend) {
      args.push('--amend')
    }
  }

  if (opts.allowEmpty) {
    args.push('--allow-empty')
  }

  if (opts.sign) {
    args.push('-S')
  }

  if (opts.noVerify) {
    args.push('--no-verify')
  }

  if (opts.author) {
    const safeAuthor = escapeAuthor(opts.author)
    args.push(`--author="${safeAuthor}"`)
  }

  // Add specific files if provided
  if (opts.files && opts.files.length > 0) {
    args.push('--')
    for (const file of opts.files) {
      args.push(escapeFilePath(file))
    }
  }

  try {
    execSync(`git ${args.join(' ')}`, {
      encoding: 'utf-8',
      cwd: opts.cwd,
      timeout: opts.timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    // Get the created commit
    const commit = getCommit('HEAD', opts)
    if (!commit) {
      throw createError('Failed to retrieve created commit')
    }

    return commit
  } catch (error) {
    if (error instanceof Error) {
      throw createError(`Failed to create commit: ${error.message}`)
    }
    throw error
  }
}

/**
 * Amends the last commit with new message.
 *
 * @param message - The new commit message to use
 * @param options - Configuration for the commit operation
 * @returns GitCommit object representing the amended commit
 *
 * @example
 * const commit = amendCommit('feat: improved feature')
 */
export function amendCommit(message: string, options: Omit<CreateCommitOptions, 'amend'> = {}): GitCommit {
  return commit(message, { ...options, amend: true })
}

/**
 * Amends the last commit without changing the message.
 * Useful for adding staged changes to the previous commit.
 *
 * @param options - Configuration for the commit operation
 * @returns GitCommit object representing the amended commit
 *
 * @example
 * stage(['extra-file.ts'])
 * amendCommitNoEdit() // adds staged files to last commit
 */
export function amendCommitNoEdit(options: Omit<CreateCommitOptions, 'amend' | 'noEdit'> = {}): GitCommit {
  return commit('', { ...options, amend: true, noEdit: true })
}

/**
 * Creates an empty commit (useful for CI triggers).
 *
 * @param message - Text for the empty commit
 * @param options - Configuration for the commit operation
 * @returns GitCommit object representing the new empty commit
 *
 * @example
 * const commit = createEmptyCommit('chore: trigger CI')
 */
export function createEmptyCommit(message: string, options: Omit<CreateCommitOptions, 'allowEmpty'> = {}): GitCommit {
  return commit(message, { ...options, allowEmpty: true })
}

// ============================================================================
// Security helpers - character-by-character validation (no regex)
// ============================================================================

/**
 * Maximum file path length.
 */
const MAX_PATH_LENGTH = 4096

/**
 * Escapes a file path for safe use in git commands.
 *
 * @param path - Path to escape
 * @returns Safe path string
 */
export function escapeFilePath(path: string): string {
  if (!path || typeof path !== 'string') {
    throw createError('File path is required')
  }

  if (path.length > MAX_PATH_LENGTH) {
    throw createError(`Path exceeds maximum length of ${MAX_PATH_LENGTH}`)
  }

  const safe: string[] = []

  for (let i = 0; i < path.length; i++) {
    const code = path.charCodeAt(i)

    // Allow: a-z, A-Z, 0-9, /, \, -, _, ., space
    if (
      (code >= 97 && code <= 122) || // a-z
      (code >= 65 && code <= 90) || // A-Z
      (code >= 48 && code <= 57) || // 0-9
      code === 47 || // /
      code === 92 || // \
      code === 45 || // -
      code === 95 || // _
      code === 46 || // .
      code === 32 // space
    ) {
      safe.push(path[i])
    } else {
      throw createError(`Invalid character in path at position ${i}: "${path[i]}"`)
    }
  }

  return safe.join('')
}

/**
 * Maximum author length.
 */
const MAX_AUTHOR_LENGTH = 500

/**
 * Escapes an author string for safe use in git commands.
 * Format: "Name <email>"
 *
 * @param author - Author to escape
 * @returns Safe author string
 */
export function escapeAuthor(author: string): string {
  if (!author || typeof author !== 'string') {
    throw createError('Author is required')
  }

  if (author.length > MAX_AUTHOR_LENGTH) {
    throw createError(`Author exceeds maximum length of ${MAX_AUTHOR_LENGTH}`)
  }

  const safe: string[] = []

  for (let i = 0; i < author.length; i++) {
    const code = author.charCodeAt(i)

    // Allow: a-z, A-Z, 0-9, space, @, ., -, _, <, >
    if (
      (code >= 97 && code <= 122) || // a-z
      (code >= 65 && code <= 90) || // A-Z
      (code >= 48 && code <= 57) || // 0-9
      code === 32 || // space
      code === 64 || // @
      code === 46 || // .
      code === 45 || // -
      code === 95 || // _
      code === 60 || // <
      code === 62 // >
    ) {
      safe.push(author[i])
    } else {
      throw createError(`Invalid character in author at position ${i}: "${author[i]}"`)
    }
  }

  return safe.join('')
}
