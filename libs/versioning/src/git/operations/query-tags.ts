import type { GitTag } from '../models/tag'

import { execFileSync } from 'node:child_process'

import { createDate } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { globalIsNaN, parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'

import { createAnnotatedTag, createLightweightTag } from '../models/tag'

import { escapeGitRef } from './log'

/**
 * Options for tag operations.
 */
export interface GitTagOptions {
  /** Working directory (defaults to cwd) */
  readonly cwd?: string

  /** Timeout in milliseconds */
  readonly timeout?: number
}

/**
 * Options for listing tags.
 */
export interface ListTagsOptions extends GitTagOptions {
  /** Pattern to filter tags by (prefix match) */
  readonly pattern?: string

  /** Sort by version (descending) */
  readonly sortByVersion?: boolean

  /** Maximum number of tags to return */
  readonly maxCount?: number
}

/**
 * Default tag options.
 */
export const DEFAULT_TAG_OPTIONS: Required<Omit<GitTagOptions, 'cwd'>> = {
  timeout: 10000,
}

/**
 * Gets all tags from the repository.
 *
 * @param options - Tag listing options
 * @returns Array of GitTag objects
 *
 * @example
 * const tags = getTags()
 * const versionTags = getTags({ pattern: 'v' })
 */
export function getTags(options: ListTagsOptions = {}): readonly GitTag[] {
  const opts = { ...DEFAULT_TAG_OPTIONS, ...options }

  const args: string[] = ['tag', '-l', '--sort=-creatordate']

  if (opts.pattern) {
    const safePattern = escapeGitTagPattern(opts.pattern)
    args.push(safePattern + '*')
  }

  try {
    const output = execFileSync('git', args, {
      encoding: 'utf-8',
      cwd: opts.cwd,
      timeout: opts.timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const tagNames = output
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    const limitedNames = opts.maxCount ? tagNames.slice(0, opts.maxCount) : tagNames

    const tags: GitTag[] = []
    for (const name of limitedNames) {
      const tag = getTagDetails(name, opts)
      if (tag) {
        tags.push(tag)
      }
    }

    return tags
  } catch {
    return []
  }
}

/**
 * Gets detailed information about a specific tag.
 *
 * @param name - The tag name to look up
 * @param options - Configuration for the tag operation
 * @returns GitTag or null if not found
 *
 * @example
 * const tag = getTag('v1.0.0')
 */
export function getTag(name: string, options: GitTagOptions = {}): GitTag | null {
  return getTagDetails(name, { ...DEFAULT_TAG_OPTIONS, ...options })
}

/**
 * Gets tag details including type and commit hash.
 *
 * @param name - The tag name to retrieve details for
 * @param options - Configuration for the tag operation
 * @returns GitTag or null
 */
function getTagDetails(name: string, options: Required<Omit<GitTagOptions, 'cwd'>> & Pick<GitTagOptions, 'cwd'>): GitTag | null {
  const safeName = escapeGitRef(name)

  try {
    const commitHash = execFileSync('git', ['rev-list', '-1', safeName], {
      encoding: 'utf-8',
      cwd: options.cwd,
      timeout: options.timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()

    try {
      const tagInfo = execFileSync('git', ['cat-file', 'tag', safeName], {
        encoding: 'utf-8',
        cwd: options.cwd,
        timeout: options.timeout,
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      const parsed = parseAnnotatedTagInfo(tagInfo)

      return createAnnotatedTag({
        name,
        commitHash,
        message: parsed.message,
        taggerName: parsed.taggerName,
        taggerEmail: parsed.taggerEmail,
        tagDate: parsed.tagDate,
      })
    } catch {
      return createLightweightTag({
        name,
        commitHash,
      })
    }
  } catch {
    return null
  }
}

/**
 * Represents the extracted data from an annotated tag.
 */
interface ParsedAnnotatedTagInfo {
  message: string
  taggerName: string
  taggerEmail: string
  tagDate: string
}

/**
 * Parses annotated tag info from git cat-file output.
 *
 * @param info - Raw tag info
 * @returns Parsed info
 */
function parseAnnotatedTagInfo(info: string): ParsedAnnotatedTagInfo {
  const lines = info.split('\n')
  let taggerName = ''
  let taggerEmail = ''
  let tagDate = ''
  let messageStart = -1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (startsWithPrefix(line, 'tagger ')) {
      const taggerLine = line.slice(7)
      const parsed = parseTaggerLine(taggerLine)
      taggerName = parsed.name
      taggerEmail = parsed.email
      tagDate = parsed.date
    }

    if (line === '' && messageStart === -1) {
      messageStart = i + 1
      break
    }
  }

  const message = messageStart >= 0 ? lines.slice(messageStart).join('\n').trim() : ''

  return {
    message,
    taggerName,
    taggerEmail,
    tagDate,
  }
}

/**
 * Parses tagger line from annotated tag.
 * Format: Name <email> timestamp timezone
 *
 * @param line - Raw tagger line from git output
 * @returns Parsed tagger info with name, email, and date
 */
function parseTaggerLine(line: string): { name: string; email: string; date: string } {
  let name = ''
  let email = ''
  let date = ''

  let emailStart = -1
  let emailEnd = -1

  for (let i = 0; i < line.length; i++) {
    if (line[i] === '<') {
      emailStart = i + 1
    } else if (line[i] === '>' && emailStart !== -1) {
      emailEnd = i
      break
    }
  }

  if (emailStart !== -1 && emailEnd !== -1) {
    name = line.slice(0, emailStart - 1).trim()
    email = line.slice(emailStart, emailEnd)

    const rest = line.slice(emailEnd + 1).trim()
    const parts = rest.split(' ')
    if (parts.length >= 1) {
      const timestamp = parseInt(parts[0], 10)
      if (!globalIsNaN(timestamp)) {
        date = createDate(timestamp * 1000).toISOString()
      }
    }
  }

  return { name, email, date }
}

/**
 * Checks if a tag exists.
 *
 * @param name - The tag name to verify
 * @param options - Configuration for the tag operation
 * @returns True if tag exists
 *
 * @example
 * if (tagExists('v1.0.0')) { ... }
 */
export function tagExists(name: string, options: GitTagOptions = {}): boolean {
  const opts = { ...DEFAULT_TAG_OPTIONS, ...options }
  const safeName = escapeGitRef(name)

  try {
    execFileSync('git', ['rev-parse', safeName], {
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
 * Gets the latest tag (by creation date).
 *
 * @param options - Tag options with optional pattern
 * @returns Latest GitTag or null
 *
 * @example
 * const latest = getLatestTag()
 * const latestVersion = getLatestTag({ pattern: 'v' })
 */
export function getLatestTag(options: ListTagsOptions = {}): GitTag | null {
  const tags = getTags({ ...options, maxCount: 1 })
  return tags[0] ?? null
}

/**
 * Gets tags that match a package name.
 *
 * @param packageName - Package name to match
 * @param options - Tag options
 * @returns Array of matching tags
 *
 * @example
 * const tags = getTagsForPackage('@scope/pkg')
 */
export function getTagsForPackage(packageName: string, options: ListTagsOptions = {}): readonly GitTag[] {
  const allTags = getTags(options)

  return allTags.filter((tag) => {
    const name = tag.name

    if (startsWithPrefix(name, packageName + '@')) {
      return true
    }

    if (startsWithPrefix(name, packageName + '-v')) {
      return true
    }

    return false
  })
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
 * Maximum tag pattern length.
 */
const MAX_PATTERN_LENGTH = 256

/**
 * Escapes a tag pattern for safe use in git commands.
 *
 * @param pattern - Pattern to escape
 * @returns Safe pattern string
 */
export function escapeGitTagPattern(pattern: string): string {
  if (!pattern || typeof pattern !== 'string') {
    throw createError('Pattern is required')
  }

  if (pattern.length > MAX_PATTERN_LENGTH) {
    throw createError(`Pattern exceeds maximum length of ${MAX_PATTERN_LENGTH}`)
  }

  const safe: string[] = []

  for (let i = 0; i < pattern.length; i++) {
    const code = pattern.charCodeAt(i)

    if (
      (code >= 97 && code <= 122) ||
      (code >= 65 && code <= 90) ||
      (code >= 48 && code <= 57) ||
      code === 47 ||
      code === 45 ||
      code === 95 ||
      code === 46 ||
      code === 64
    ) {
      safe.push(pattern[i])
    } else {
      throw createError(`Invalid character in pattern at position ${i}: "${pattern[i]}"`)
    }
  }

  return safe.join('')
}
