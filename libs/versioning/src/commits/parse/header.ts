import type { CommitType } from '../models/commit-type'

export interface ParsedHeader {
  type: CommitType
  scope?: string
  subject: string
  breaking: boolean
}

/**
 * Parses a conventional commit header line.
 *
 * @param line - The first line of the commit message
 * @returns Parsed header with type, scope, subject, and breaking flag
 */
export function parseHeader(line: string): ParsedHeader {
  let pos = 0
  const len = line.length

  // Extract type (alphanumeric characters until ( or : or !)
  const typeStart = pos
  while (pos < len) {
    const char = line[pos]
    const code = char.charCodeAt(0)

    // a-z, A-Z, 0-9
    if ((code >= 97 && code <= 122) || (code >= 65 && code <= 90) || (code >= 48 && code <= 57)) {
      pos++
    } else {
      break
    }
  }

  const type = <CommitType>line.slice(typeStart, pos).toLowerCase()

  // Check for scope in parentheses
  let scope: string | undefined
  if (line[pos] === '(') {
    pos++ // skip (
    const scopeStart = pos

    while (pos < len && line[pos] !== ')') {
      pos++
    }

    scope = line.slice(scopeStart, pos)

    if (line[pos] === ')') {
      pos++ // skip )
    }
  }

  // Check for breaking change indicator (!)
  const breaking = line[pos] === '!'
  if (breaking) {
    pos++
  }

  // Expect colon
  if (line[pos] === ':') {
    pos++
  }

  // Skip whitespace after colon
  while (pos < len && line[pos] === ' ') {
    pos++
  }

  // Rest is subject
  const subject = line.slice(pos).trim()

  return {
    type,
    scope,
    subject,
    breaking,
  }
}
