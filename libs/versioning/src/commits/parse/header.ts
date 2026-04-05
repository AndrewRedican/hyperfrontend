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

  const typeStart = pos
  while (pos < len) {
    const code = line.charCodeAt(pos)

    if ((code >= 97 && code <= 122) || (code >= 65 && code <= 90) || (code >= 48 && code <= 57)) {
      pos++
    } else {
      break
    }
  }

  const type = <CommitType>line.slice(typeStart, pos).toLowerCase()

  let scope: string | undefined
  if (line[pos] === '(') {
    pos++
    const scopeStart = pos

    while (pos < len && line[pos] !== ')') {
      pos++
    }

    scope = line.slice(scopeStart, pos)

    if (line[pos] === ')') {
      pos++
    }
  }

  const breaking = line[pos] === '!'
  if (breaking) {
    pos++
  }

  if (line[pos] === ':') {
    pos++
  }

  while (pos < len && line[pos] === ' ') {
    pos++
  }

  const subject = line.slice(pos).trim()

  return {
    type,
    scope,
    subject,
    breaking,
  }
}
