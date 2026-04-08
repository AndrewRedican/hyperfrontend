import type { CommitFooter } from '../models/conventional'
import { isBreakingFooterKey } from '../models/breaking'

/** Parsed footer section of a commit message. */
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
 *
 * @example
 * ```typescript
 * const lines = ['feat: add feature', '', 'Refs: #123', 'Fixes #456']
 * const result = parseFooters(lines, 2)
 * // => {
 * //   footers: [
 * //     { key: 'Refs', value: '#123', separator: ':' },
 * //     { key: 'Fixes', value: '456', separator: ' #' }
 * //   ],
 * //   breakingDescription: undefined
 * // }
 * ```
 */
export function parseFooters(lines: string[], startIndex: number): ParsedFooters {
  const footers: CommitFooter[] = []
  let breakingDescription: string | undefined

  let pos = startIndex

  while (pos < lines.length) {
    const currentLine = lines[pos]
    if (currentLine === undefined || currentLine.trim() !== '') break
    pos++
  }

  while (pos < lines.length) {
    const line = lines[pos]
    if (line === undefined) {
      pos++
      continue
    }
    const footer = parseFooterLine(line)

    if (footer) {
      footers.push(footer)

      if (isBreakingFooterKey(footer.key)) {
        breakingDescription = footer.value

        pos++
        while (pos < lines.length) {
          const nextLineCheck = lines[pos]
          if (nextLineCheck === undefined || isNewFooter(nextLineCheck)) break
          const nextLine = nextLineCheck
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

  let pos = 0

  const tokenStart = pos
  while (pos < trimmed.length) {
    const code = trimmed.charCodeAt(pos)

    if ((code >= 97 && code <= 122) || (code >= 65 && code <= 90) || (code >= 48 && code <= 57) || code === 45) {
      pos++
    } else {
      break
    }
  }

  if (pos === tokenStart) return null

  const key = trimmed.slice(tokenStart, pos)

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
