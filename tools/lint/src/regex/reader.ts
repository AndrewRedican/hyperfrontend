/**
 * The pattern a parser reads: its text, the mode its flags put it in, the position reached and
 * the characters read so far, which are kept even when the pattern turns out to be invalid.
 *
 * @module regex/reader
 */

import type { CharacterNode } from './model.ts'

/** The hexadecimal digits, by value. */
const HEX_DIGITS = '0123456789abcdef'

/** Why a pattern was refused, with where. */
export class PatternFailure extends Error {
  /** The offset in the pattern the fault was found at. */
  readonly index: number

  /**
   * Creates the failure.
   *
   * @param message - What was wrong
   * @param index - Where it was found
   */
  constructor(message: string, index: number) {
    super(message)
    this.index = index
  }
}

/**
 * The value of a hexadecimal digit.
 *
 * @param char - A character, undefined or empty past the end of the text
 * @returns Its value, or -1 when it is no hexadecimal digit
 */
export function hexValue(char: string | undefined): number {
  return char === undefined || char.length !== 1 ? -1 : HEX_DIGITS.indexOf(char.toLowerCase())
}

/**
 * Whether a character is a decimal digit.
 *
 * @param char - The character tested
 * @returns True for `0` to `9`
 */
export function isDigit(char: string): boolean {
  return char >= '0' && char <= '9' && char.length === 1
}

/**
 * Whether a character is an octal digit.
 *
 * @param char - The character tested
 * @returns True for `0` to `7`
 */
export function isOctalDigit(char: string): boolean {
  return char >= '0' && char <= '7' && char.length === 1
}

/**
 * Whether a character is an ASCII letter.
 *
 * @param char - The character tested
 * @returns True for `a` to `z` and `A` to `Z`
 */
export function isAsciiLetter(char: string): boolean {
  return char.length === 1 && ((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z'))
}

/**
 * The code point a character stands for.
 *
 * @param char - A single character, as one or two code units
 * @returns Its code point
 */
export function codePointOf(char: string): number {
  return char.codePointAt(0) as number
}

/** Reads a pattern one character at a time: a code point in unicode mode, a UTF-16 unit otherwise. */
export class PatternReader {
  /** The pattern text. */
  readonly source: string
  /** Whether the pattern is read under the `u` or `v` flag, where a surrogate pair is one character. */
  readonly unicode: boolean
  /** Whether the pattern is read under the `v` flag, where classes nest and combine. */
  readonly unicodeSets: boolean
  /** Whether the pattern declares a named group, which makes `\k` a named reference under no flag. */
  namedGroups = false
  /** The offset of the next character. */
  index = 0
  /** The characters read so far, in order. */
  readonly characters: CharacterNode[] = []

  /**
   * Opens a pattern for reading.
   *
   * @param source - The pattern text
   * @param unicode - Whether the `u` or `v` flag is set
   * @param unicodeSets - Whether the `v` flag is set
   */
  constructor(source: string, unicode: boolean, unicodeSets: boolean) {
    this.source = source
    this.unicode = unicode
    this.unicodeSets = unicodeSets
  }

  /**
   * The character at an offset: a whole surrogate pair in unicode mode, one code unit otherwise.
   *
   * @param index - The offset read at
   * @returns The character, or the empty string past the end
   */
  at(index: number): string {
    if (index >= this.source.length) return ''
    const code = this.source.codePointAt(index) as number
    return this.unicode && code > 0xffff ? this.source.slice(index, index + 2) : (this.source[index] as string)
  }

  /**
   * The next character, without consuming it.
   *
   * @returns The character, or the empty string at the end
   */
  peek(): string {
    return this.at(this.index)
  }

  /**
   * The character after the next one, without consuming anything.
   *
   * @returns The character, or the empty string past the end
   */
  peekSecond(): string {
    return this.at(this.index + this.peek().length)
  }

  /**
   * Consumes the next character.
   *
   * @returns The character consumed, or the empty string at the end
   */
  advance(): string {
    const char = this.peek()
    this.index += char.length
    return char
  }

  /**
   * Whether a text comes next.
   *
   * @param text - The text looked for
   * @returns True when the source continues with it
   */
  ahead(text: string): boolean {
    return this.source.startsWith(text, this.index)
  }

  /**
   * Consumes a text when it comes next.
   *
   * @param text - The text looked for
   * @returns True when it was consumed
   */
  eat(text: string): boolean {
    if (!this.ahead(text)) return false
    this.index += text.length
    return true
  }

  /**
   * Consumes exactly `count` hexadecimal digits.
   *
   * @param count - How many digits are needed
   * @returns Their value, or null, with nothing consumed, when fewer follow
   */
  hexDigits(count: number): number | null {
    let value = 0
    for (let offset = 0; offset < count; offset += 1) {
      const digit = hexValue(this.source[this.index + offset])
      if (digit < 0) return null
      value = value * 16 + digit
    }
    this.index += count
    return value
  }

  /**
   * Records a character read from an offset up to the current position.
   *
   * @param start - The offset the character's text starts at
   * @param value - The code point it matches
   * @returns The character node, also appended to the characters read
   */
  character(start: number, value: number): CharacterNode {
    const node: CharacterNode = {
      kind: 'Character',
      start,
      end: this.index,
      parent: null,
      value,
      raw: this.source.slice(start, this.index),
    }
    this.characters.push(node)
    return node
  }

  /**
   * Refuses the pattern.
   *
   * @param message - What is wrong
   * @param index - Where, the current position unless given
   */
  raise(message: string, index: number = this.index): never {
    throw new PatternFailure(message, index)
  }
}
