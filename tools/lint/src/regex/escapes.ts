/**
 * What a backslash introduces in a pattern: a control, hexadecimal, unicode or legacy octal
 * escape standing for one character, an escape standing for a set such as `\d` or `\p{...}`,
 * the identity escapes each grammar allows, and the escapes a group name may carry.
 *
 * @module regex/escapes
 */

import type { CharacterNode, CharacterSetKind, CharacterSetNode } from './model.ts'
import type { PatternReader } from './reader.ts'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { fromCodePoint } from '@hyperfrontend/immutable-api-utils/built-in-copy/string'
import { codePointOf, hexValue, isAsciiLetter, isDigit, isOctalDigit } from './reader.ts'

/** The characters the single-letter control escapes stand for. */
const CONTROL_ESCAPES = createMap<string, number>([
  ['t', 9],
  ['n', 10],
  ['v', 11],
  ['f', 12],
  ['r', 13],
])

/** The sets the class escape letters stand for. */
const CLASS_ESCAPES = createMap<string, CharacterSetKind>([
  ['d', 'digit'],
  ['D', 'digit'],
  ['s', 'space'],
  ['S', 'space'],
  ['w', 'word'],
  ['W', 'word'],
])

/** The characters a backslash may precede for themselves under the `u` or `v` flag. */
const SYNTAX_CHARACTERS = createSet('^$\\.*+?()[]{}|/'.split(''))

/** The punctuators a backslash may also precede for themselves inside a `v` class. */
const CLASS_SET_RESERVED_PUNCTUATORS = createSet('&-!#%,:;<=>@`~'.split(''))

/** The property names that match strings, which only the `v` flag admits. */
const STRING_PROPERTIES = createSet([
  'Basic_Emoji',
  'Emoji_Keycap_Sequence',
  'RGI_Emoji_Modifier_Sequence',
  'RGI_Emoji_Flag_Sequence',
  'RGI_Emoji_Tag_Sequence',
  'RGI_Emoji_ZWJ_Sequence',
  'RGI_Emoji',
])

/** The characters that may start a group name. */
const IDENTIFIER_START = /^[\p{ID_Start}$_]$/u

/** The characters that may continue a group name. */
const IDENTIFIER_PART = /^[\p{ID_Continue}$\u200c\u200d]$/u

/** The largest code point. */
const MAX_CODE_POINT = 0x10ffff

/**
 * Makes a character set node for `.` or a class escape.
 *
 * @param start - The offset the set's text starts at
 * @param end - The offset after it
 * @param set - Which set
 * @param negate - Whether the escape names the complement
 * @returns The node, without a parent
 */
export function characterSetNode(start: number, end: number, set: CharacterSetKind, negate: boolean): CharacterSetNode {
  return { kind: 'CharacterSet', start, end, parent: null, set, negate, key: null, value: null, strings: false }
}

/**
 * Whether a code unit is a lead surrogate.
 *
 * @param code - The code unit tested
 * @returns True in the lead surrogate range
 */
function isLeadSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff
}

/**
 * Reads the unicode escape of a trail surrogate when one follows, so that a pair becomes one character.
 *
 * @param reader - The reader, standing after a lead surrogate's escape
 * @returns The trail surrogate, or null with nothing consumed when no such escape follows
 */
function readTrailSurrogate(reader: PatternReader): number | null {
  const mark = reader.index
  if (reader.eat('\\u')) {
    const trail = reader.hexDigits(4)
    if (trail !== null && trail >= 0xdc00 && trail <= 0xdfff) return trail
  }
  reader.index = mark
  return null
}

/**
 * The code point a surrogate pair encodes.
 *
 * @param lead - The lead surrogate
 * @param trail - The trail surrogate
 * @returns The code point
 */
function combineSurrogates(lead: number, trail: number): number {
  return (lead - 0xd800) * 0x400 + (trail - 0xdc00) + 0x10000
}

/**
 * Reads the digits and closing brace of a `\u{...}` escape.
 *
 * @param reader - The reader, standing after the opening brace
 * @returns The code point between the braces
 */
export function readBracedCodePoint(reader: PatternReader): number {
  let value = 0
  let digits = 0
  for (let digit = hexValue(reader.peek()); digit >= 0; digit = hexValue(reader.peek())) {
    value = value * 16 + digit
    digits += 1
    reader.advance()
  }
  if (digits === 0 || value > MAX_CODE_POINT || !reader.eat('}')) reader.raise('Invalid unicode escape')
  return value
}

/**
 * Reads a `\cX` control escape.
 *
 * @param reader - The reader, standing on the `c`
 * @param start - The offset of the backslash
 * @param inClass - Whether the escape sits in a character class, where the legacy grammar also takes a digit or `_`
 * @returns The character, or null with nothing consumed when no control letter follows
 */
function readControlLetter(reader: PatternReader, start: number, inClass: boolean): CharacterNode | null {
  const letter = reader.peekSecond()
  if (!isAsciiLetter(letter) && !(inClass && !reader.unicode && (isDigit(letter) || letter === '_'))) return null
  reader.advance()
  reader.advance()
  return reader.character(start, codePointOf(letter) % 32)
}

/**
 * Reads a `\xHH` escape.
 *
 * @param reader - The reader, standing on the `x`
 * @param start - The offset of the backslash
 * @returns The character, or null with nothing consumed when two hexadecimal digits do not follow
 */
function readHexEscape(reader: PatternReader, start: number): CharacterNode | null {
  reader.advance()
  const value = reader.hexDigits(2)
  if (value === null) {
    reader.index -= 1
    return null
  }
  return reader.character(start, value)
}

/**
 * Reads a `\uHHHH` escape, with the trail surrogate escape that may follow it under a unicode
 * flag, or a `\u{...}` escape under a unicode flag.
 *
 * @param reader - The reader, standing on the `u`
 * @param start - The offset of the backslash
 * @returns The character, or null with nothing consumed when the legacy grammar finds no escape
 */
function readUnicodeEscape(reader: PatternReader, start: number): CharacterNode | null {
  const mark = reader.index
  reader.advance()
  if (reader.unicode && reader.eat('{')) return reader.character(start, readBracedCodePoint(reader))
  const lead = reader.hexDigits(4)
  if (lead === null) {
    if (reader.unicode) reader.raise('Invalid unicode escape')
    reader.index = mark
    return null
  }
  if (reader.unicode && isLeadSurrogate(lead)) {
    const trail = readTrailSurrogate(reader)
    if (trail !== null) return reader.character(start, combineSurrogates(lead, trail))
  }
  return reader.character(start, lead)
}

/**
 * Reads a legacy octal escape of one to three digits, as the grammar without a unicode flag allows.
 *
 * @param reader - The reader, standing on the first octal digit
 * @param start - The offset of the backslash
 * @returns The character
 */
function readLegacyOctal(reader: PatternReader, start: number): CharacterNode {
  const first = reader.advance()
  let value = codePointOf(first) - 48
  if (isOctalDigit(reader.peek())) {
    value = value * 8 + codePointOf(reader.advance()) - 48
    if (first <= '3' && isOctalDigit(reader.peek())) value = value * 8 + codePointOf(reader.advance()) - 48
  }
  return reader.character(start, value)
}

/**
 * Reads an identity escape: a backslash before a character that then stands for itself.
 *
 * @param reader - The reader, standing on the escaped character
 * @param start - The offset of the backslash
 * @param inClass - Whether the escape sits in a character class, which admits a few more characters
 * @returns The character, or null with nothing consumed when the grammar refuses the escape
 */
function readIdentityEscape(reader: PatternReader, start: number, inClass: boolean): CharacterNode | null {
  const char = reader.peek()
  if (reader.unicode) {
    const allowed =
      SYNTAX_CHARACTERS.has(char) || (inClass && (char === '-' || (reader.unicodeSets && CLASS_SET_RESERVED_PUNCTUATORS.has(char))))
    if (!allowed) return null
  } else if (char === 'c' || (char === 'k' && reader.namedGroups)) return null
  reader.advance()
  return reader.character(start, codePointOf(char))
}

/**
 * Reads an escape that stands for one character. The reader stands after the backslash, on a
 * character that is not the end of the pattern.
 *
 * @param reader - The reader, past the backslash
 * @param start - The offset of the backslash
 * @param inClass - Whether the escape sits in a character class
 * @returns The character, or null with nothing consumed when what follows is no character escape
 */
export function readCharacterEscape(reader: PatternReader, start: number, inClass: boolean): CharacterNode | null {
  const char = reader.peek()
  const control = CONTROL_ESCAPES.get(char)
  if (control !== undefined) {
    reader.advance()
    return reader.character(start, control)
  }
  if (char === 'c') return readControlLetter(reader, start, inClass)
  if (char === '0' && !isDigit(reader.peekSecond())) {
    reader.advance()
    return reader.character(start, 0)
  }
  if (char === 'x') {
    const hex = readHexEscape(reader, start)
    if (hex !== null) return hex
  }
  if (char === 'u') {
    const unicode = readUnicodeEscape(reader, start)
    if (unicode !== null) return unicode
  }
  if (!reader.unicode && isOctalDigit(char)) return readLegacyOctal(reader, start)
  return readIdentityEscape(reader, start, inClass)
}

/**
 * Reads the word of a property escape's name or value.
 *
 * @param reader - The reader, at the first letter
 * @returns The word, empty when none follows
 */
function readPropertyWord(reader: PatternReader): string {
  const start = reader.index
  for (let char = reader.peek(); isAsciiLetter(char) || isDigit(char) || char === '_'; char = reader.peek()) reader.advance()
  return reader.source.slice(start, reader.index)
}

/**
 * Reads a `\p{...}` or `\P{...}` property escape.
 *
 * @param reader - The reader, standing on the `p` or `P`
 * @param start - The offset of the backslash
 * @param negate - Whether the escape is `\P`, naming the complement
 * @returns The set
 */
function readProperty(reader: PatternReader, start: number, negate: boolean): CharacterSetNode {
  reader.advance()
  if (!reader.eat('{')) reader.raise('Invalid property name')
  const key = readPropertyWord(reader)
  const value = reader.eat('=') ? readPropertyWord(reader) : null
  if (key === '' || value === '' || !reader.eat('}')) reader.raise('Invalid property name')
  const strings = value === null && STRING_PROPERTIES.has(key)
  if (strings && (negate || !reader.unicodeSets)) reader.raise('Invalid property name')
  return { kind: 'CharacterSet', start, end: reader.index, parent: null, set: 'property', negate, key, value, strings }
}

/**
 * Reads an escape that stands for a set of characters: `\d`, `\D`, `\s`, `\S`, `\w`, `\W`, or a
 * property escape under a unicode flag. The reader stands after the backslash.
 *
 * @param reader - The reader, past the backslash
 * @param start - The offset of the backslash
 * @returns The set, or null with nothing consumed when what follows is no class escape
 */
export function readClassEscape(reader: PatternReader, start: number): CharacterSetNode | null {
  const char = reader.peek()
  const set = CLASS_ESCAPES.get(char)
  if (set !== undefined) {
    reader.advance()
    return characterSetNode(start, reader.index, set, char === char.toUpperCase())
  }
  if ((char === 'p' || char === 'P') && reader.unicode) return readProperty(reader, start, char === 'P')
  return null
}

/**
 * Reads one character of a group name, written as itself or as a unicode escape; a surrogate
 * pair is one character whatever the flags.
 *
 * @param reader - The reader, standing on the character
 * @returns The character, a surrogate pair joined
 */
function readNameCharacter(reader: PatternReader): string {
  if (!reader.eat('\\')) {
    const char = fromCodePoint(reader.source.codePointAt(reader.index) as number)
    reader.index += char.length
    return char
  }
  if (!reader.eat('u')) reader.raise('Invalid capture group name')
  if (reader.eat('{')) return fromCodePoint(readBracedCodePoint(reader))
  const lead = reader.hexDigits(4)
  if (lead === null) reader.raise('Invalid capture group name')
  if (isLeadSurrogate(lead)) {
    const trail = readTrailSurrogate(reader)
    if (trail !== null) return fromCodePoint(combineSurrogates(lead, trail))
  }
  return fromCodePoint(lead)
}

/**
 * Reads a group name up to and including the closing `>`.
 *
 * @param reader - The reader, standing after the opening `<`
 * @returns The name, escapes decoded
 */
export function readGroupName(reader: PatternReader): string {
  const start = reader.index
  let name = ''
  while (!reader.ahead('>')) {
    if (reader.peek() === '') reader.raise('Invalid capture group name', start)
    const char = readNameCharacter(reader)
    if (!(name === '' ? IDENTIFIER_START : IDENTIFIER_PART).test(char)) reader.raise('Invalid capture group name', start)
    name += char
  }
  if (name === '') reader.raise('Invalid capture group name', start)
  reader.index += 1
  return name
}
