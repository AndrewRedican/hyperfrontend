import type { ConventionalCommit } from '../models/conventional'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { isStandardType } from '../models/commit-type'
import { hyphenToSpace } from '../utils/replace-char'
import { parseBody } from './body'
import { parseFooters } from './footer'
import { parseHeader } from './header'

/**
 * Maximum commit message length (10KB)
 */
const MAX_MESSAGE_LENGTH = 10 * 1024

/**
 * Parses a conventional commit message.
 *
 * @param message - The complete commit message
 * @returns Parsed ConventionalCommit object
 * @throws {Error} If message exceeds maximum length
 *
 * @example
 * ```typescript
 * parseConventionalCommit('feat(auth): add login\n\nImplements OAuth.\n\nRefs: #123')
 * // => {
 * //   type: 'feat',
 * //   scope: 'auth',
 * //   subject: 'add login',
 * //   body: 'Implements OAuth.',
 * //   footers: [{ key: 'Refs', value: '#123', separator: ':' }],
 * //   breaking: false,
 * //   raw: '...'
 * // }
 * ```
 */
export function parseConventionalCommit(message: string): ConventionalCommit {
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw createError(`Commit message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`)
  }

  const lines = splitLines(message)

  if (lines.length === 0) {
    return {
      type: '',
      subject: '',
      footers: [],
      breaking: false,
      raw: message,
    }
  }

  const firstLine = lines[0]
  if (firstLine === undefined) {
    return {
      type: '',
      subject: '',
      footers: [],
      breaking: false,
      raw: message,
    }
  }

  const header = parseHeader(firstLine)

  let body: string | undefined
  let footersStartIndex = 1

  if (lines.length > 1) {
    const bodyResult = parseBody(lines, 1)
    if (bodyResult) {
      body = bodyResult.body
      footersStartIndex = bodyResult.endIndex
    }
  }

  const footersResult = parseFooters(lines, footersStartIndex)
  const breakingDescriptionFromFooter = footersResult.breakingDescription

  const breaking = header.breaking || footersResult.footers.some((f) => hyphenToSpace(f.key.toUpperCase()) === 'BREAKING CHANGE')

  let breakingDescription: string | undefined
  if (header.breaking && header.subject) {
    breakingDescription = header.subject
  }
  if (breakingDescriptionFromFooter) {
    breakingDescription = breakingDescriptionFromFooter
  }

  return {
    type: header.type,
    scope: header.scope,
    subject: header.subject,
    body,
    footers: footersResult.footers,
    breaking,
    breakingDescription,
    raw: message,
  }
}

/**
 * Splits a message into lines, handling different line endings.
 *
 * @param message - The message to split into lines
 * @returns An array of lines from the message
 */
function splitLines(message: string): string[] {
  const lines: string[] = []
  let currentLine = ''
  let i = 0

  while (i < message.length) {
    const char = message[i]

    if (char === '\r') {
      lines.push(currentLine)
      currentLine = ''
      if (message[i + 1] === '\n') {
        i++
      }
    } else if (char === '\n') {
      lines.push(currentLine)
      currentLine = ''
    } else {
      currentLine += char
    }

    i++
  }

  if (currentLine || message.endsWith('\n') || message.endsWith('\r')) {
    lines.push(currentLine)
  }

  return lines
}

/**
 * Checks if a commit message follows conventional commit format.
 *
 * @param message - The commit message to check
 * @returns true if the message appears to be a conventional commit
 *
 * @example
 * ```typescript
 * isConventionalCommit('feat(auth): add OAuth login')
 * // => true
 *
 * isConventionalCommit('WIP: still working on this')
 * // => false
 *
 * isConventionalCommit('fix: resolve bug')
 * // => true
 * ```
 */
export function isConventionalCommit(message: string): boolean {
  if (!message || message.trim() === '') {
    return false
  }

  const firstLine = message.split('\n')[0] ?? ''
  const header = parseHeader(firstLine)

  if (!header.type || !header.subject) {
    return false
  }

  if (header.type.length > 20) {
    return false
  }

  if (!isStandardType(header.type)) {
    return false
  }

  return true
}
