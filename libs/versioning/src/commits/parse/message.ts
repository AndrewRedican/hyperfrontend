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

  // Parse header (first line)
  const header = parseHeader(lines[0])

  // Parse body and footers
  let body: string | undefined
  let footersStartIndex = 1

  if (lines.length > 1) {
    const bodyResult = parseBody(lines, 1)
    if (bodyResult) {
      body = bodyResult.body
      footersStartIndex = bodyResult.endIndex
    }
  }

  // Parse footers
  const footersResult = parseFooters(lines, footersStartIndex)
  const breakingDescriptionFromFooter = footersResult.breakingDescription

  // Determine breaking status
  const breaking = header.breaking || footersResult.footers.some((f) => hyphenToSpace(f.key.toUpperCase()) === 'BREAKING CHANGE')

  // Determine breaking description
  let breakingDescription: string | undefined
  if (header.breaking && header.subject) {
    // If breaking via !, the subject may describe the breaking change
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
      // Skip \n if this is \r\n
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

  // Add final line if not empty
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
 */
export function isConventionalCommit(message: string): boolean {
  if (!message || message.trim() === '') {
    return false
  }

  const firstLine = message.split('\n')[0] ?? ''
  const header = parseHeader(firstLine)

  // Must have a type and subject
  if (!header.type || !header.subject) {
    return false
  }

  // Type should not be too long (indicates not a type)
  if (header.type.length > 20) {
    return false
  }

  // Type should be a recognized conventional commit type
  if (!isStandardType(header.type)) {
    return false
  }

  return true
}
