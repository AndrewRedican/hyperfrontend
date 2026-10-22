import type { CharacterNode, CharacterSetNode } from './model.ts'
import type { PatternFailure } from './reader.ts'
import { describe, expect, it } from '@hyperfrontend/testing'
import { characterSetNode, readBracedCodePoint, readCharacterEscape, readClassEscape, readGroupName } from './escapes.ts'
import { PatternReader } from './reader.ts'

/**
 * What reading a braced code point from a text gives.
 *
 * @param text - The text after the opening brace
 * @param unicode - Whether the reader is in unicode mode
 * @returns The code point and the index reached, or the failure
 */
function braced(text: string, unicode = true): readonly [number, number] | string {
  const reader = new PatternReader(text, unicode, false)
  try {
    return [readBracedCodePoint(reader), reader.index]
  } catch (error) {
    return (error as PatternFailure).message
  }
}

/**
 * What reading a character escape gives: the value and raw text, or null.
 *
 * @param text - The text, starting with the backslash
 * @param unicode - Whether the reader is in unicode mode
 * @param inClass - Whether the escape sits in a class
 * @returns The value and raw text, or null
 */
function escape(text: string, unicode: boolean, inClass: boolean): readonly [number, string] | null {
  const reader = new PatternReader(text, unicode, unicode && text.includes('v'))
  reader.index = 1
  const node = readCharacterEscape(reader, 0, inClass)
  return node === null ? null : [node.value, node.raw]
}

describe('characterSetNode', () => {
  it('makes a set without a property', () => {
    expect(characterSetNode(0, 1, 'any', false)).toEqual({
      kind: 'CharacterSet',
      start: 0,
      end: 1,
      parent: null,
      set: 'any',
      negate: false,
      key: null,
      value: null,
      strings: false,
    })
  })
})

describe('readBracedCodePoint', () => {
  it('reads the digits up to the brace', () => {
    expect(braced('1F44D}x')).toEqual([0x1f44d, 6])
  })
  it('refuses an empty, unterminated or too large escape', () => {
    expect([braced('}'), braced('41'), braced('110000}')]).toEqual([
      'Invalid unicode escape',
      'Invalid unicode escape',
      'Invalid unicode escape',
    ])
  })
})

describe('readCharacterEscape', () => {
  it('reads control escapes', () => {
    expect(['t', 'n', 'v', 'f', 'r'].map((letter) => escape(`\\${letter}`, false, false))).toEqual([
      [9, '\\t'],
      [10, '\\n'],
      [11, '\\v'],
      [12, '\\f'],
      [13, '\\r'],
    ])
  })
  it('reads a control letter and leaves a control that has none', () => {
    expect([escape('\\cJ', false, false), escape('\\c1', false, false), escape('\\c1', false, true), escape('\\c1', true, true)]).toEqual([
      [10, '\\cJ'],
      null,
      [17, '\\c1'],
      null,
    ])
  })
  it('reads a bare zero as NUL in both grammars', () => {
    expect([escape('\\0', true, false), escape('\\0a', false, false), escape('\\01', true, false)]).toEqual([[0, '\\0'], [0, '\\0'], null])
  })
  it('reads hexadecimal escapes and leaves a short one to the legacy identity escape', () => {
    expect([escape('\\x4F', false, false), escape('\\x4', false, false), escape('\\x4', true, false)]).toEqual([
      [0x4f, '\\x4F'],
      [120, '\\x'],
      null,
    ])
  })
  it('reads a legacy octal escape only without a unicode flag', () => {
    expect([
      escape('\\377', false, false),
      escape('\\378', false, false),
      escape('\\47', false, false),
      escape('\\4', true, false),
    ]).toEqual([[255, '\\377'], [31, '\\37'], [39, '\\47'], null])
  })
  it('admits an identity escape of the syntax characters and the slash under a unicode flag', () => {
    expect(['\\/', '\\.', '\\-', '\\a'].map((text) => escape(text, true, false))).toEqual([[47, '\\/'], [46, '\\.'], null, null])
  })
  it('admits a dash and the reserved punctuators inside a class under the matching flags', () => {
    expect([escape('\\-', true, true), escape('\\@', true, true), escape('\\@v', true, true), escape('\\av', true, true)]).toEqual([
      [45, '\\-'],
      null,
      [64, '\\@'],
      null,
    ])
  })
  it('admits any identity escape but `c` under no unicode flag', () => {
    expect([escape('\\a', false, false), escape('\\@', false, false), escape('\\c', false, false)]).toEqual([
      [97, '\\a'],
      [64, '\\@'],
      null,
    ])
  })
  it('refuses `k` as an identity escape once the pattern names a group', () => {
    const reader = new PatternReader('\\k', false, false)
    reader.namedGroups = true
    reader.index = 1
    expect(readCharacterEscape(reader, 0, false)).toBe(null)
  })
})

describe('readClassEscape', () => {
  it('reads the letter escapes with their complements', () => {
    const sets = ['d', 'D', 's', 'S', 'w', 'W'].map((letter) => {
      const reader = new PatternReader(`\\${letter}`, false, false)
      reader.index = 1
      const node = readClassEscape(reader, 0) as CharacterSetNode
      return [node.set, node.negate, node.end]
    })
    expect(sets).toEqual([
      ['digit', false, 2],
      ['digit', true, 2],
      ['space', false, 2],
      ['space', true, 2],
      ['word', false, 2],
      ['word', true, 2],
    ])
  })
  it('reads a property with a value', () => {
    const reader = new PatternReader('\\p{Script=Latin}', true, false)
    reader.index = 1
    expect(readClassEscape(reader, 0)).toEqual({
      kind: 'CharacterSet',
      start: 0,
      end: 16,
      parent: null,
      set: 'property',
      negate: false,
      key: 'Script',
      value: 'Latin',
      strings: false,
    })
  })
  it('leaves a property escape alone under no unicode flag', () => {
    const reader = new PatternReader('\\p{L}', false, false)
    reader.index = 1
    expect([readClassEscape(reader, 0), reader.index]).toEqual([null, 1])
  })
})

describe('readGroupName', () => {
  it('reads a name of escapes and characters', () => {
    const reader = new PatternReader('a\\u{62}\\u0063_$>', false, false)
    expect([readGroupName(reader), reader.index]).toEqual(['abc_$', 16])
  })
  it('refuses a name with a character that may not continue it', () => {
    const reader = new PatternReader('a-b>', false, false)
    let message = ''
    try {
      readGroupName(reader)
    } catch (error) {
      message = (error as PatternFailure).message
    }
    expect(message).toBe('Invalid capture group name')
  })
  it('keeps a lead surrogate escape apart from what is no trail surrogate', () => {
    const reader = new PatternReader('\\uD835\\u0041>', false, false)
    let message = ''
    try {
      readGroupName(reader)
    } catch (error) {
      message = (error as PatternFailure).message
    }
    expect(message).toBe('Invalid capture group name')
  })
})

describe('surrogate pairs', () => {
  it('joins an escaped pair under a unicode flag and keeps an escaped lead before a plain trail', () => {
    const joined = escape('\\uD83D\\uDC4D', true, false) as readonly [number, string]
    const apart = escape('\\uD83D\uDC4D', true, false) as readonly [number, string]
    expect([joined, apart]).toEqual([
      [0x1f44d, '\\uD83D\\uDC4D'],
      [0xd83d, '\\uD83D'],
    ])
  })
  it('records the character read', () => {
    const reader = new PatternReader('\\n', false, false)
    reader.index = 1
    const node = readCharacterEscape(reader, 0, false) as CharacterNode
    expect(reader.characters).toEqual([node])
  })
})
