/**
 * The character classes and word tables the scanner reads from.
 *
 * @module code/scanner-tables
 */

import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/** The punctuators, longest first within each leading character, as the scanner tries them. */
export const PUNCTUATORS: readonly string[] = [
  '>>>=',
  '...',
  '===',
  '!==',
  '**=',
  '<<=',
  '>>=',
  '>>>',
  '&&=',
  '||=',
  '??=',
  '=>',
  '==',
  '!=',
  '<=',
  '>=',
  '&&',
  '||',
  '??',
  '?.',
  '++',
  '--',
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  '&=',
  '|=',
  '^=',
  '**',
  '<<',
  '>>',
  '{',
  '}',
  '(',
  ')',
  '[',
  ']',
  ';',
  ',',
  '<',
  '>',
  '+',
  '-',
  '*',
  '/',
  '%',
  '&',
  '|',
  '^',
  '!',
  '~',
  '?',
  ':',
  '=',
  '.',
  '@',
  '#',
]

/** The words that are never identifiers. */
export const RESERVED = createSet([
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'new',
  'null',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
])

/**
 * Whether a character can begin an identifier.
 *
 * @param char - One character, or the end of the text
 * @returns True for a letter, `$`, `_` or a Unicode identifier start
 *
 * @example Check the first character of a name
 * ```ts
 * isIdentifierStart('$') // => true
 * isIdentifierStart('é') // => true
 * isIdentifierStart('9') // => false
 * ```
 */
export function isIdentifierStart(char: string | undefined): boolean {
  if (char === undefined) return false
  const code = char.charCodeAt(0)
  if (code < 128) return (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 36 || code === 95
  return /[\p{ID_Start}]/u.test(char)
}

/**
 * Whether a character can continue an identifier.
 *
 * @param char - One character, or the end of the text
 * @returns True for a letter, digit, `$`, `_` or a Unicode identifier part
 *
 * @example Digits and the zero-width joiner continue a name
 * ```ts
 * isIdentifierPart('9') // => true
 * isIdentifierPart('\u200d') // => true
 * isIdentifierPart('-') // => false
 * ```
 */
export function isIdentifierPart(char: string | undefined): boolean {
  if (char === undefined) return false
  const code = char.charCodeAt(0)
  if (code < 128)
    return (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || (code >= 48 && code <= 57) || code === 36 || code === 95
  return /[\p{ID_Continue}\u200c\u200d]/u.test(char)
}

/**
 * Whether a character ends a line.
 *
 * @param char - One character, or the end of the text
 * @returns True for a line feed, carriage return, line or paragraph separator
 *
 * @example Unicode separators end a line
 * ```ts
 * isLineBreak('\u2028') // => true
 * isLineBreak('\t') // => false
 * ```
 */
export function isLineBreak(char: string | undefined): boolean {
  return char === '\n' || char === '\r' || char === '\u2028' || char === '\u2029'
}

/**
 * Whether a character is whitespace other than a line break.
 *
 * @param char - One character, or the end of the text
 * @returns True for a space, tab, form feed, vertical tab, byte-order mark or Unicode space
 *
 * @example The zero-width space counts, a line feed does not
 * ```ts
 * isWhitespace('\u200b') // => true
 * isWhitespace('\n') // => false
 * ```
 */
export function isWhitespace(char: string | undefined): boolean {
  if (char === undefined) return false
  if (char === ' ' || char === '\t' || char === '\v' || char === '\f' || char === '\ufeff' || char === '\u00a0') return true
  // why: the compiler also skips the next-line and zero-width space characters, which Unicode does not class as spaces.
  if (char === '\u0085' || char === '\u200b') return true
  return char.charCodeAt(0) > 127 && /\p{Zs}/u.test(char)
}

/**
 * Whether a character is a decimal digit.
 *
 * @param char - One character, or the end of the text
 * @returns True for `0` to `9`
 *
 * @example Only ASCII digits count
 * ```ts
 * isDigit('7') // => true
 * isDigit('\u0663') // => false (Arabic-Indic three)
 * ```
 */
export function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= '0' && char <= '9'
}

/**
 * The character at an index, as a whole code point: two code units for a surrogate pair.
 *
 * @param text - The text scanned
 * @param index - The offset of the character
 * @returns The character, or undefined past the end
 *
 * @example Read a surrogate pair as one character
 * ```ts
 * const text = 'a\u{1F600}b'
 * characterAt(text, 1).length // => 2 (the whole emoji)
 * characterAt(text, 2).length // => 1 (its low surrogate alone)
 * characterAt(text, 9) // => undefined
 * ```
 */
export function characterAt(text: string, index: number): string | undefined {
  const char = text[index]
  if (char === undefined) return undefined
  const code = char.charCodeAt(0)
  if (code < 0xd800 || code > 0xdbff) return char
  const next = text[index + 1]
  if (next === undefined) return char
  const low = next.charCodeAt(0)
  return low >= 0xdc00 && low <= 0xdfff ? char + next : char
}
