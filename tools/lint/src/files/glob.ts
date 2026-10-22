/**
 * Glob patterns over POSIX paths, as configuration `files` and `ignores` entries name them:
 * `*` within a segment, `**` across segments, `?`, `[...]` classes, `{a,b}` alternatives and a
 * trailing `/` that names a directory and everything in it. A pattern compiles once to a regular
 * expression built from escaped literals, so no input text reaches the expression unescaped.
 *
 * @module files/glob
 */

import { createRegExp } from '@hyperfrontend/immutable-api-utils/built-in-copy/regexp'

/** A compiled pattern. */
export interface Glob {
  /** The pattern as written. */
  readonly pattern: string
  /** Whether a path matches. */
  readonly test: (path: string) => boolean
}

/** Characters that mean themselves inside a regular expression only when escaped. */
const SPECIAL = /[.+^$()|\\]/

/**
 * Compiles a pattern.
 *
 * @param pattern - The text as a configuration wrote it
 * @returns The same text with a matcher beside it
 */
export function compileGlob(pattern: string): Glob {
  const directory = pattern.endsWith('/')
  const source = `^${translate(directory ? pattern.slice(0, -1) : pattern)}${directory ? '(?:/.*)?' : ''}$`
  // why: the source is assembled from escaped literals and fixed fragments, never from the pattern text as written.
  // lint-disable-next-line workspace/no-unsafe-regex
  const expression = createRegExp(source)
  return { pattern, test: (path) => expression.test(path) }
}

/**
 * Whether a path matches any of the patterns.
 *
 * @param globs - Compiled patterns
 * @param path - A POSIX path relative to the patterns' base
 * @returns True when one matches
 */
export function matchesAny(globs: readonly Glob[], path: string): boolean {
  return globs.some((glob) => glob.test(path))
}

/**
 * Translates a glob into regular-expression source.
 *
 * @param pattern - The glob without a trailing slash
 * @returns The source, without anchors
 */
function translate(pattern: string): string {
  let source = ''
  let index = 0
  while (index < pattern.length) {
    const char = pattern[index]
    if (char === '*') {
      if (pattern[index + 1] === '*') {
        const slashBefore = index === 0 || pattern[index - 1] === '/'
        const slashAfter = pattern[index + 2] === '/'
        if (slashBefore && slashAfter) {
          source += '(?:.*/)?'
          index += 3
          continue
        }
        if (slashBefore && index + 2 === pattern.length) {
          source += '.*'
          index += 2
          continue
        }
        source += '[^/]*'
        index += 2
        continue
      }
      source += '[^/]*'
      index += 1
    } else if (char === '?') {
      source += '[^/]'
      index += 1
    } else if (char === '[') {
      const close = pattern.indexOf(']', index + 1)
      if (close === -1) {
        source += '\\['
        index += 1
      } else {
        const body = pattern.slice(index + 1, close)
        source += `[${body.startsWith('!') ? `^${body.slice(1)}` : body}]`
        index = close + 1
      }
    } else if (char === '{') {
      const close = pattern.indexOf('}', index + 1)
      if (close === -1) {
        source += '\\{'
        index += 1
      } else {
        source += `(?:${pattern
          .slice(index + 1, close)
          .split(',')
          .map(translate)
          .join('|')})`
        index = close + 1
      }
    } else {
      source += SPECIAL.test(char) ? `\\${char}` : char
      index += 1
    }
  }
  return source
}
