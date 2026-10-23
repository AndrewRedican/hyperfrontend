import { describe, expect, it } from '@hyperfrontend/testing'
import { PatternFailure, PatternReader, codePointOf, hexValue, isAsciiLetter, isDigit, isOctalDigit } from './reader'

describe('hexValue', () => {
  it('values a digit', () => {
    expect([hexValue('0'), hexValue('9'), hexValue('a'), hexValue('F')]).toEqual([0, 9, 10, 15])
  })
  it('refuses what is no single hexadecimal digit', () => {
    expect([hexValue(undefined), hexValue(''), hexValue('g'), hexValue('ab')]).toEqual([-1, -1, -1, -1])
  })
})

describe('character tests', () => {
  it('tells digits', () => {
    expect([isDigit('0'), isDigit('9'), isDigit('a'), isDigit(''), isDigit('12')]).toEqual([true, true, false, false, false])
  })
  it('tells octal digits', () => {
    expect([isOctalDigit('7'), isOctalDigit('8'), isOctalDigit('')]).toEqual([true, false, false])
  })
  it('tells ASCII letters', () => {
    expect([isAsciiLetter('a'), isAsciiLetter('Z'), isAsciiLetter('1'), isAsciiLetter('é'), isAsciiLetter('ab')]).toEqual([
      true,
      true,
      false,
      false,
      false,
    ])
  })
  it('gives the code point of a character', () => {
    expect([codePointOf('a'), codePointOf('👍')]).toEqual([97, 0x1f44d])
  })
})

describe('PatternReader', () => {
  it('reads a surrogate pair as one character in unicode mode', () => {
    const reader = new PatternReader('👍a', true, false)
    expect([reader.peek(), reader.peekSecond(), reader.advance(), reader.index, reader.peek()]).toEqual(['👍', 'a', '👍', 2, 'a'])
  })
  it('reads a surrogate pair as two characters otherwise', () => {
    const reader = new PatternReader('👍', false, false)
    expect([reader.peek().length, reader.peekSecond().length, reader.advance().length, reader.index]).toEqual([1, 1, 1, 1])
  })
  it('reads nothing past the end', () => {
    const reader = new PatternReader('a', false, false)
    reader.advance()
    expect([reader.peek(), reader.peekSecond(), reader.advance(), reader.index]).toEqual(['', '', '', 1])
  })
  it('consumes a text that comes next and leaves one that does not', () => {
    const reader = new PatternReader('abc', false, false)
    expect([reader.eat('x'), reader.ahead('ab'), reader.eat('ab'), reader.index, reader.eat('c'), reader.eat('c')]).toEqual([
      false,
      true,
      true,
      2,
      true,
      false,
    ])
  })
  it('consumes exactly the hexadecimal digits asked for', () => {
    const reader = new PatternReader('1f2', false, false)
    expect([reader.hexDigits(2), reader.index, reader.hexDigits(2), reader.index]).toEqual([0x1f, 2, null, 2])
  })
  it('records a character with its text and keeps it', () => {
    const reader = new PatternReader('\\x41', false, false)
    reader.index = 4
    const node = reader.character(0, 0x41)
    expect([node, reader.characters]).toEqual([{ kind: 'Character', start: 0, end: 4, parent: null, value: 0x41, raw: '\\x41' }, [node]])
  })
  it('refuses the pattern at the current position', () => {
    const reader = new PatternReader('ab', false, false)
    reader.advance()
    let failure: PatternFailure | null = null
    try {
      reader.raise('bad')
    } catch (error) {
      failure = error as PatternFailure
    }
    expect([failure?.message, failure?.index, failure instanceof PatternFailure]).toEqual(['bad', 1, true])
  })
  it('refuses the pattern at a position named', () => {
    const reader = new PatternReader('ab', false, false)
    let index = -1
    try {
      reader.raise('bad', 7)
    } catch (error) {
      index = (error as PatternFailure).index
    }
    expect(index).toBe(7)
  })
})
