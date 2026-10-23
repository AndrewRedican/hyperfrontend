/**
 * The characters written as escapes and entities: a backslash before ASCII punctuation, named
 * references for the entities documentation uses, and numeric references.
 *
 * @module markdown/entities
 */

import { parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { fromCharCode } from '@hyperfrontend/immutable-api-utils/built-in-copy/string'

/** The named entities decoded; any other name stays as written. */
const NAMED: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  copy: '©',
  reg: '®',
  trade: '™',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  laquo: '«',
  raquo: '»',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
  larr: '←',
  rarr: '→',
  uarr: '↑',
  darr: '↓',
  harr: '↔',
  times: '×',
  middot: '·',
  bull: '•',
  deg: '°',
  para: '¶',
  sect: '§',
  euro: '€',
  pound: '£',
  yen: '¥',
  cent: '¢',
  shy: '­',
  ensp: ' ',
  emsp: ' ',
  thinsp: ' ',
  zwnj: '‌',
  zwj: '‍',
  check: '✓',
  cross: '✗',
  infin: '∞',
  ne: '≠',
  le: '≤',
  ge: '≥',
  plusmn: '±',
  micro: 'µ',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
}

/** A decoded reference. */
export interface Decoded {
  /** The character it stands for. */
  readonly value: string
  /** The offset after the semicolon. */
  readonly end: number
}

/**
 * Whether a character is ASCII punctuation, which a backslash escapes.
 *
 * @param char - One character
 * @returns True for punctuation
 *
 * @example Decide whether a backslash escapes the next character
 * ```ts
 * isAsciiPunctuation('*') // => true
 * isAsciiPunctuation('a') // => false
 * isAsciiPunctuation(undefined) // => false (end of text)
 * ```
 */
export function isAsciiPunctuation(char: string | undefined): boolean {
  return char !== undefined && char.length === 1 && /[!-/:-@[-`{-~]/.test(char)
}

/**
 * The character reference at an offset.
 *
 * @param text - The document
 * @param at - The ampersand
 * @returns The decoded character with the offset after the semicolon, or null
 *
 * @example Decode named and numeric references
 * ```ts
 * entityAt('Tom &amp; Jerry', 4) // => { value: '&', end: 9 }
 * entityAt('&#35;', 0) // => { value: '#', end: 5 }
 * entityAt('&bogus;', 0) // => null (unknown name)
 * ```
 */
export function entityAt(text: string, at: number): Decoded | null {
  const match = /^&(?:#[xX]([0-9a-fA-F]{1,6})|#([0-9]{1,7})|([A-Za-z][A-Za-z0-9]{1,31}));/.exec(text.slice(at, at + 40))
  if (match === null) return null
  const end = at + match[0].length
  if (match[3] !== undefined) return match[3] in NAMED ? { value: NAMED[match[3]], end } : null
  const code = match[1] !== undefined ? parseInt(match[1], 16) : Number(match[2])
  return { value: code === 0 || code > 0x10ffff ? '�' : fromCharCode(...codeUnits(code)), end }
}

/**
 * The UTF-16 code units of a code point.
 *
 * @param code - The code point
 * @returns One or two units
 */
function codeUnits(code: number): number[] {
  if (code < 0x10000) return [code]
  const offset = code - 0x10000
  return [0xd800 + (offset >> 10), 0xdc00 + (offset & 0x3ff)]
}

/**
 * A text with its escapes and entities decoded.
 *
 * @param raw - The text as written
 * @returns The text as read
 *
 * @example Read escapes and entities as plain text
 * ```ts
 * decodeText('\\*literal\\* &copy; 2026 \\q')
 * // => '*literal* © 2026 \\q' (q is not punctuation)
 * ```
 */
export function decodeText(raw: string): string {
  let out = ''
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index]
    if (char === '\\' && isAsciiPunctuation(raw[index + 1])) {
      out += raw[index + 1]
      index += 1
    } else if (char === '&') {
      const entity = entityAt(raw, index)
      if (entity === null) out += char
      else {
        out += entity.value
        index = entity.end - 1
      }
    } else out += char
  }
  return out
}
