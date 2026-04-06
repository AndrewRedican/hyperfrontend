import type { CommitRef, IssueRef } from '../models/commit-ref'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'

/**
 * Parses a version string from a heading.
 * Examples: "1.2.3", "v1.2.3", "[1.2.3]", "1.2.3 - 2024-01-01"
 *
 * @param heading - The heading string to parse
 * @returns An object containing the parsed version, date, and optional compareUrl
 */
export function parseVersionFromHeading(heading: string): {
  /** The parsed version string */
  version: string
  /** The parsed date in YYYY-MM-DD format, or null if not found */
  date: string | null
  /** Optional URL for comparing versions */
  compareUrl?: string
} {
  const trimmed = heading.trim()

  const lowerHeading = trimmed.toLowerCase()
  if (lowerHeading === 'unreleased' || lowerHeading === '[unreleased]') {
    return { version: 'Unreleased', date: null }
  }

  let pos = 0
  let date: string | null = null
  let compareUrl: string | undefined

  if (trimmed[pos] === '[') {
    pos++
  }

  if (trimmed[pos] === 'v' || trimmed[pos] === 'V') {
    pos++
  }

  const versionStart = pos
  while (pos < trimmed.length) {
    const code = trimmed.charCodeAt(pos)
    const char = trimmed[pos]

    if (
      (code >= 48 && code <= 57) ||
      char === '.' ||
      char === '-' ||
      char === '+' ||
      (code >= 97 && code <= 122) ||
      (code >= 65 && code <= 90)
    ) {
      pos++
    } else {
      break
    }
  }

  const version = trimmed.slice(versionStart, pos)

  if (trimmed[pos] === ']') {
    pos++
  }

  if (trimmed[pos] === '(') {
    const urlStart = pos + 1
    let depth = 1
    pos++

    while (pos < trimmed.length && depth > 0) {
      if (trimmed[pos] === '(') depth++
      else if (trimmed[pos] === ')') depth--
      pos++
    }

    if (depth === 0) {
      compareUrl = trimmed.slice(urlStart, pos - 1)
    }
  }

  while (pos < trimmed.length && (trimmed[pos] === ' ' || trimmed[pos] === '-' || trimmed[pos] === '–')) {
    pos++
  }

  if (pos < trimmed.length) {
    const dateMatch = extractDate(trimmed.slice(pos))
    if (dateMatch) {
      date = dateMatch.date
      pos += dateMatch.length
    }
  }

  while (pos < trimmed.length && trimmed[pos] === ' ') {
    pos++
  }

  if (pos < trimmed.length && !compareUrl) {
    const linkMatch = extractLink(trimmed.slice(pos))
    if (linkMatch?.url) {
      compareUrl = linkMatch.url
    }
  }

  return { version, date, compareUrl }
}

/**
 * Extracts a date in YYYY-MM-DD format from a string.
 *
 * @param str - The string to extract a date from
 * @returns The extracted date and its length, or null if no date found
 */
function extractDate(str: string): {
  /** The extracted date string in YYYY-MM-DD format */
  date: string
  /** Number of characters consumed from the input */
  length: number
} | null {
  let pos = 0

  if (str[pos] === '(') pos++

  const yearStart = pos
  while (pos < str.length && pos - yearStart < 4) {
    const code = str.charCodeAt(pos)
    if (code >= 48 && code <= 57) {
      pos++
    } else {
      break
    }
  }

  if (pos - yearStart !== 4) return null

  if (str[pos] !== '-' && str[pos] !== '/') return null
  const separator = str[pos]
  pos++

  const monthStart = pos
  while (pos < str.length && pos - monthStart < 2) {
    const code = str.charCodeAt(pos)
    if (code >= 48 && code <= 57) {
      pos++
    } else {
      break
    }
  }

  if (pos - monthStart !== 2) return null

  if (str[pos] !== separator) return null
  pos++

  const dayStart = pos
  while (pos < str.length && pos - dayStart < 2) {
    const code = str.charCodeAt(pos)
    if (code >= 48 && code <= 57) {
      pos++
    } else {
      break
    }
  }

  if (pos - dayStart !== 2) return null

  if (str[pos] === ')') pos++

  const dateStr = str.slice(yearStart, dayStart + 2)
  const date = slashToHyphen(dateStr)
  return { date, length: pos }
}

/**
 * Replaces forward slashes with hyphens (ReDoS-safe).
 *
 * @param input - The input string
 * @returns String with forward slashes replaced by hyphens
 */
function slashToHyphen(input: string): string {
  const result: string[] = []
  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (char !== undefined) result.push(char === '/' ? '-' : char)
  }
  return result.join('')
}

/**
 * Extracts a markdown link from a string.
 *
 * @param str - The string to extract a link from
 * @returns The extracted link text, url, and length, or null if no link found
 */
function extractLink(str: string): {
  /** The link text content */
  text: string
  /** The link URL */
  url: string
  /** Number of characters consumed from the input */
  length: number
} | null {
  if (str[0] !== '[') return null

  let pos = 1
  let depth = 1

  while (pos < str.length && depth > 0) {
    if (str[pos] === '[') depth++
    else if (str[pos] === ']') depth--
    pos++
  }

  if (depth !== 0) return null

  const text = str.slice(1, pos - 1)

  if (str[pos] !== '(') return null
  pos++

  const urlStart = pos
  depth = 1
  while (pos < str.length && depth > 0) {
    if (str[pos] === '(') depth++
    else if (str[pos] === ')') depth--
    pos++
  }

  if (depth !== 0) return null

  const url = str.slice(urlStart, pos - 1)

  return { text, url, length: pos }
}

/**
 * Parses commit references from a line.
 * Examples: (abc1234), [abc1234], commit abc1234
 *
 * @param text - The text to parse for commit references
 * @param baseUrl - Optional base URL for constructing commit links
 * @returns An array of parsed CommitRef objects
 */
export function parseCommitRefs(text: string, baseUrl?: string): CommitRef[] {
  const refs: CommitRef[] = []
  let pos = 0

  while (pos < text.length) {
    if (text[pos] === '(' || text[pos] === '[') {
      const closeChar = text[pos] === '(' ? ')' : ']'
      const start = pos + 1
      pos++

      while (pos < text.length) {
        const char = text[pos]
        if (char === undefined || !isHexDigit(char)) break
        pos++
      }

      const hash = text.slice(start, pos)
      if (hash.length >= 7 && hash.length <= 40 && text[pos] === closeChar) {
        refs.push({
          hash,
          shortHash: hash.slice(0, 7),
          url: baseUrl ? `${baseUrl}/commit/${hash}` : undefined,
        })
        pos++
        continue
      }
    }

    pos++
  }

  return refs
}

/**
 * Parses issue/PR references from a line.
 * Examples: #123, GH-123, closes #123
 *
 * @param text - The text to parse for issue references
 * @param baseUrl - Optional base URL for constructing issue links
 * @returns An array of parsed IssueRef objects
 */
export function parseIssueRefs(text: string, baseUrl?: string): IssueRef[] {
  const refs: IssueRef[] = []
  let pos = 0

  while (pos < text.length) {
    if (text[pos] === '#') {
      pos++
      const numStart = pos

      while (pos < text.length) {
        const char = text[pos]
        if (char === undefined || !isDigitChar(char)) break
        pos++
      }

      if (pos > numStart) {
        const number = parseInt(text.slice(numStart, pos), 10)

        const beforeHash = text.slice(max(0, numStart - 10), numStart - 1).toLowerCase()
        const type: 'pull-request' | 'issue' = beforeHash.includes('pr') || beforeHash.includes('pull') ? 'pull-request' : 'issue'

        refs.push({
          number,
          type,
          url: baseUrl ? `${baseUrl}/issues/${number}` : undefined,
        })
        continue
      }
    }

    pos++
  }

  return refs
}

/**
 * Parses the scope from a changelog item.
 * Example: "**scope:** description" -> { scope: "scope", description: "description" }
 *
 * @param text - The text to parse for scope
 * @returns An object with optional scope and the description
 */
export function parseScopeFromItem(text: string): {
  /** Optional scope extracted from the text */
  scope?: string
  /** The description text after the scope */
  description: string
} {
  const trimmed = text.trim()

  if (trimmed.startsWith('**')) {
    let pos = 2
    const scopeStart = pos

    while (pos < trimmed.length && trimmed[pos] !== '*' && trimmed[pos] !== ':') {
      pos++
    }

    if (trimmed[pos] === ':' && trimmed[pos + 1] === '*' && trimmed[pos + 2] === '*') {
      const scope = trimmed.slice(scopeStart, pos)
      pos += 3

      while (trimmed[pos] === ' ') pos++

      return { scope, description: trimmed.slice(pos) }
    }

    if (trimmed[pos] === '*' && trimmed[pos + 1] === '*') {
      const scope = trimmed.slice(scopeStart, pos)
      pos += 2

      if (trimmed[pos] === ':') pos++

      while (trimmed[pos] === ' ') pos++

      return { scope, description: trimmed.slice(pos) }
    }
  }

  const colonPos = trimmed.indexOf(':')
  if (colonPos > 0 && colonPos < 30) {
    const potentialScope = trimmed.slice(0, colonPos)
    if (isValidScope(potentialScope)) {
      const description = trimmed.slice(colonPos + 1).trim()
      return { scope: potentialScope, description }
    }
  }

  return { description: trimmed }
}

/**
 * Checks if a string is a valid scope (alphanumeric with hyphens).
 *
 * @param str - The string to check
 * @returns True if the string is a valid scope identifier
 */
function isValidScope(str: string): boolean {
  if (!str || str.length === 0) return false

  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (!(code >= 48 && code <= 57) && !(code >= 65 && code <= 90) && !(code >= 97 && code <= 122) && code !== 45) {
      return false
    }
  }

  return true
}

/**
 * Checks if a character is a hex digit.
 *
 * @param char - The character to check
 * @returns True if the character is a hex digit (0-9, A-F, a-f)
 */
function isHexDigit(char: string): boolean {
  const code = char.charCodeAt(0)
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 70) || (code >= 97 && code <= 102)
}

/**
 * Checks if a character is a digit.
 *
 * @param char - The character to check
 * @returns True if the character is a digit (0-9)
 */
function isDigitChar(char: string): boolean {
  const code = char.charCodeAt(0)
  return code >= 48 && code <= 57
}
