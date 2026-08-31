import type { CommitType } from '../models/commit-type'

/**
 * Parsed conventional commit header components.
 */
export interface ParsedHeader {
  /** Commit type (feat, fix, chore, etc.) */
  type: CommitType
  /** Scopes from parentheses (empty array when header has no scope) */
  scope: readonly string[]
  /** Commit subject line */
  subject: string
  /** Whether this is a breaking change */
  breaking: boolean
}

/**
 * Parses a conventional commit header line.
 *
 * Supports comma-separated multi-scope headers such as `feat(a,b): x` which
 * produce a multi-element scope array. Single-scope headers produce a
 * one-element array, and scopeless headers produce an empty array.
 *
 * @param line - The first line of the commit message
 * @returns Parsed header with type, scope array, subject, and breaking flag
 *
 * @example Parsing conventional commit headers
 * ```typescript
 * parseHeader('feat(auth): add OAuth login')
 * // => { type: 'feat', scope: ['auth'], subject: 'add OAuth login', breaking: false }
 *
 * parseHeader('fix!: critical security patch')
 * // => { type: 'fix', scope: [], subject: 'critical security patch', breaking: true }
 *
 * parseHeader('feat(versioning,questions): add searchable select')
 * // => { type: 'feat', scope: ['versioning', 'questions'], subject: 'add searchable select', breaking: false }
 * ```
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

  const type = line.slice(typeStart, pos).toLowerCase() as CommitType

  let scope: readonly string[] = []
  if (line[pos] === '(') {
    pos++
    const scopeStart = pos

    while (pos < len && line[pos] !== ')') {
      pos++
    }

    scope = splitScopes(line.slice(scopeStart, pos))

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

/**
 * Splits the raw scope text between parentheses into an array of scopes.
 *
 * An empty raw string yields a single-element `['']` to preserve the
 * distinction between `feat: x` (no parens, scope=[]) and `feat(): x`
 * (parens present but empty, scope=['']).
 *
 * @param raw - Raw text between the parentheses
 * @returns Split scope array
 */
function splitScopes(raw: string): readonly string[] {
  if (raw === '') {
    return ['']
  }
  return raw.split(',').map((s) => s.trim())
}
