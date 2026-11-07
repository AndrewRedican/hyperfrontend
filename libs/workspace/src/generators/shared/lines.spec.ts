import { describe, expect, it } from '@hyperfrontend/testing'
import { PRINT_WIDTH, blockBounds, findLine, indentOf, joinLines, quote, splitLines } from './lines'

describe('splitLines', () => {
  it('splits on the line feed a file is written with', () => {
    expect(splitLines('a\nb\n')).toEqual({ lines: ['a', 'b', ''], eol: '\n' })
  })

  it('keeps a carriage return line ending out of the lines and remembers it', () => {
    expect(splitLines('a\r\nb')).toEqual({ lines: ['a', 'b'], eol: '\r\n' })
  })
})

describe('joinLines', () => {
  it('restores the text a split came from, line ending included', () => {
    expect(joinLines(splitLines('a\r\nb\r\n'))).toBe('a\r\nb\r\n')
  })
})

describe('indentOf', () => {
  it('returns the leading whitespace and nothing after it', () => {
    expect([indentOf('    packages: ['), indentOf('name')]).toEqual(['    ', ''])
  })
})

describe('findLine', () => {
  it('returns the first index at or after the start that the predicate accepts', () => {
    expect(findLine(['x', 'y', 'x'], (line) => line === 'x', 1)).toBe(2)
  })

  it('returns -1 when no line is accepted', () => {
    expect(findLine(['x'], (line) => line === 'y', 0)).toBe(-1)
  })
})

describe('blockBounds', () => {
  it('finds the opening line and the first closing line after it', () => {
    expect(
      blockBounds(
        [']', 'open', 'a', ']', ']'],
        (line) => line === 'open',
        (line) => line === ']',
        'list'
      )
    ).toEqual({ open: 1, close: 3 })
  })

  it('names the block when it never opens', () => {
    expect(() =>
      blockBounds(
        ['a'],
        (line) => line === 'open',
        (line) => line === ']',
        'the list'
      )
    ).toThrow('the list: the block that opens it was not found')
  })

  it('names the block and its opening line when it never closes', () => {
    expect(() =>
      blockBounds(
        ['open', 'a'],
        (line) => line === 'open',
        (line) => line === ']',
        'the list'
      )
    ).toThrow('the list: the block opens on line 1 and never closes')
  })
})

describe('quote', () => {
  it('writes a single-quoted literal with quotes and backslashes escaped', () => {
    expect(quote("a team's \\ app")).toBe("'a team\\'s \\\\ app'")
  })
})

describe('PRINT_WIDTH', () => {
  it('matches the width the workspace formatter wraps at', () => {
    expect(PRINT_WIDTH).toBe(140)
  })
})
