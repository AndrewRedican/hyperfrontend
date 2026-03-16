import type { CommitFooter } from '../models/conventional'
import { isBreakingFooterKey } from '../models/breaking'

export interface ParsedFooters {
  /** All parsed footers */
  footers: CommitFooter[]
  /** Breaking change description if found */
  breakingDescription?: string
}

/**
 * Parses the footer section of a commit message.
 *
 * @param lines - All lines of the commit message
 * @param startIndex - Index where footers start
 * @returns Parsed footers
 */
export function parseFooters(lines: string[], startIndex: number): ParsedFooters {
  const footers: CommitFooter[] = []
  let breakingDescription: string | undefined

  let pos = startIndex

  // Skip blank lines
  while (pos < lines.length && lines[pos].trim() === '') {
    pos++
  }

  while (pos < lines.length) {
    const line = lines[pos]
    const footer = parseFooterLine(line)

    if (footer) {
      footers.push(footer)

      // Check for breaking change
      if (isBreakingFooterKey(footer.key)) {
        breakingDescription = footer.value

        // Breaking description may span multiple lines
        pos++
        while (pos < lines.length && !isNewFooter(lines[pos])) {
          const nextLine = lines[pos]
          if (nextLine.trim() !== '') {
            breakingDescription += '\n' + nextLine
          }
          pos++
        }
        continue
      }
    }

    pos++
  }

  return { footers, breakingDescription }
}

/**
 * Parses a single footer line.
 *
 * @param line - The line to parse
 * @returns The parsed CommitFooter or null if not a valid footer
 */
function parseFooterLine(line: string): CommitFooter | null {
  if (!line) return null

  const trimmed = line.trim()
  if (trimmed === '') return null

  // Check for BREAKING CHANGE or BREAKING-CHANGE
  if (trimmed.startsWith('BREAKING CHANGE:')) {
    return {
      key: 'BREAKING CHANGE',
      value: trimmed.slice(16).trim(),
      separator: ':',
    }
  }

  if (trimmed.startsWith('BREAKING-CHANGE:')) {
    return {
      key: 'BREAKING-CHANGE',
      value: trimmed.slice(16).trim(),
      separator: ':',
    }
  }

  // Parse token: value or token #value
  let pos = 0

  // Read token
  const tokenStart = pos
  while (pos < trimmed.length) {
    const char = trimmed[pos]
    const code = char.charCodeAt(0)

    if (
      (code >= 97 && code <= 122) || // a-z
      (code >= 65 && code <= 90) || // A-Z
      (code >= 48 && code <= 57) || // 0-9
      code === 45 // -
    ) {
      pos++
    } else {
      break
    }
  }

  if (pos === tokenStart) return null

  const key = trimmed.slice(tokenStart, pos)

  // Check separator
  let separator: ':' | ' #'
  let valueStart: number

  if (trimmed[pos] === ':') {
    separator = ':'
    valueStart = pos + 1
  } else if (trimmed[pos] === ' ' && trimmed[pos + 1] === '#') {
    separator = ' #'
    valueStart = pos + 2
  } else {
    return null
  }

  // Skip whitespace after separator (for : case)
  if (separator === ':') {
    while (valueStart < trimmed.length && trimmed[valueStart] === ' ') {
      valueStart++
    }
  }

  const value = trimmed.slice(valueStart)

  return { key, value, separator }
}

/**
 * Checks if a line starts a new footer.
 *
 * @param line - The line to check
 * @returns True if the line starts a new footer
 */
function isNewFooter(line: string): boolean {
  if (!line) return false
  return parseFooterLine(line) !== null
}
