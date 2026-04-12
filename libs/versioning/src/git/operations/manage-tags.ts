import type { GitTag } from '../models/tag'
import type { GitTagOptions } from './query-tags'
import { execFileSync } from 'node:child_process'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { escapeGitRef } from './log'
import { DEFAULT_TAG_OPTIONS, getTag } from './query-tags'

/**
 * Options for creating a tag.
 */
export interface CreateTagOptions extends GitTagOptions {
  /** Tag message (creates annotated tag if provided) */
  readonly message?: string

  /** Target commit (defaults to HEAD) */
  readonly target?: string

  /** Force overwrite if tag exists */
  readonly force?: boolean
}

/**
 * Creates a new tag.
 *
 * @param name - The name for the new tag
 * @param options - Configuration including optional message for annotated tags
 * @returns Created GitTag
 *
 * @example Create lightweight and annotated tags
 * // Create lightweight tag
 * const tag = createTag('v1.0.0')
 *
 * // Create annotated tag
 * const tag = createTag('v1.0.0', { message: 'Release v1.0.0' })
 */
export function createTag(name: string, options: CreateTagOptions = {}): GitTag {
  const opts = { ...DEFAULT_TAG_OPTIONS, ...options }
  const safeName = escapeGitRef(name)

  const args: string[] = ['tag']

  if (opts.force) {
    args.push('-f')
  }

  if (opts.message) {
    args.push('-a')
    args.push(safeName)
    args.push('-m', escapeGitMessage(opts.message))
  } else {
    args.push(safeName)
  }

  if (opts.target) {
    args.push(escapeGitRef(opts.target))
  }

  try {
    execFileSync('git', args, {
      encoding: 'utf-8',
      cwd: opts.cwd,
      timeout: opts.timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const tag = getTag(name, opts)
    if (!tag) {
      throw createError(`Failed to retrieve created tag: ${name}`)
    }

    return tag
  } catch (error) {
    if (error instanceof Error) {
      throw createError(`Failed to create tag ${name}: ${error.message}`)
    }
    throw error
  }
}

/**
 * Deletes a tag.
 *
 * @param name - The tag name to delete
 * @param options - Configuration for the tag operation
 * @returns True if deleted
 *
 * @example Delete a tag by name
 * const deleted = deleteTag('v1.0.0')
 */
export function deleteTag(name: string, options: GitTagOptions = {}): boolean {
  const opts = { ...DEFAULT_TAG_OPTIONS, ...options }
  const safeName = escapeGitRef(name)

  try {
    execFileSync('git', ['tag', '-d', safeName], {
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
 * Pushes a tag to a remote.
 *
 * @param name - The tag to push to the remote
 * @param remote - Remote name (defaults to 'origin')
 * @param options - Configuration for the tag operation
 * @returns True if pushed successfully
 *
 * @example Push a tag to remote
 * pushTag('v1.0.0')
 * pushTag('v1.0.0', 'upstream')
 */
export function pushTag(name: string, remote = 'origin', options: GitTagOptions = {}): boolean {
  if (remote.startsWith('-')) {
    return false
  }
  const opts = { ...DEFAULT_TAG_OPTIONS, ...options }
  const safeName = escapeGitRef(name)
  const safeRemote = escapeGitRef(remote)

  try {
    execFileSync('git', ['push', safeRemote, safeName], {
      encoding: 'utf-8',
      cwd: opts.cwd,
      timeout: opts.timeout * 3,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return true
  } catch {
    return false
  }
}

/**
 * Maximum message length.
 */
const MAX_MESSAGE_LENGTH = 10000

/**
 * Escapes a message for safe use in git commands.
 *
 * @param message - Message to escape
 * @returns Safe message string
 *
 * @example Escape a git commit message
 * ```typescript
 * const safeMessage = escapeGitMessage('Release v1.0.0 "stable"')
 * // => 'Release v1.0.0 \"stable\"'
 * ```
 */
export function escapeGitMessage(message: string): string {
  if (!message || typeof message !== 'string') {
    throw createError('Message is required')
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    throw createError(`Message exceeds maximum length of ${MAX_MESSAGE_LENGTH}`)
  }

  const safe: string[] = []

  for (let i = 0; i < message.length; i++) {
    const char = message[i]
    const code = message.charCodeAt(i)

    if (char === '"' || char === '\\') {
      safe.push('\\')
      safe.push(char)
    } else if ((code >= 32 && code <= 126) || code === 10 || code === 13 || code === 9) {
      safe.push(char)
    }
  }

  return safe.join('')
}
