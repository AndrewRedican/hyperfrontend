import { describe, expect, it } from '@hyperfrontend/testing'
import { lineMap, lineText, positionAt } from './lines'

describe('lineMap', () => {
  it('starts every line after a line feed', () => {
    expect(lineMap('ab\ncd\r\n\nef').starts).toEqual([0, 3, 7, 8])
  })

  it('leaves a lone carriage return and the separators inside a line of a text that is not code', () => {
    expect(lineMap('a\rb\u2028c').starts).toEqual([0])
  })

  it('breaks code at every line terminator, a carriage return and line feed counting once', () => {
    expect(lineMap('a\rb\u2028c\u2029d\r\ne\nf', true).starts).toEqual([0, 2, 4, 6, 9, 11])
  })

  it('has one line for a text without line feeds', () => {
    expect(lineMap('abc').starts).toEqual([0])
  })
})

describe('positionAt', () => {
  const map = lineMap('ab\ncd\r\n\nef')

  it('places the first character on line 1, column 1', () => {
    expect(positionAt(map, 0)).toEqual({ line: 1, column: 1 })
  })

  it('places a character after a line feed on the next line', () => {
    expect(positionAt(map, 4)).toEqual({ line: 2, column: 2 })
  })

  it('places the line feed itself on the line it ends', () => {
    expect(positionAt(map, 2)).toEqual({ line: 1, column: 3 })
  })

  it('places the end of the text after the last character', () => {
    expect(positionAt(map, 10)).toEqual({ line: 4, column: 3 })
  })
})

describe('lineText', () => {
  const map = lineMap('ab\ncd\r\n\nef')

  it('returns a line without its line feed', () => {
    expect(lineText(map, 1)).toBe('ab')
  })

  it('drops a carriage return before the line feed', () => {
    expect(lineText(map, 2)).toBe('cd')
  })

  it('returns an empty line', () => {
    expect(lineText(map, 3)).toBe('')
  })

  it('returns the last line, which has no line feed', () => {
    expect(lineText(map, 4)).toBe('ef')
  })
})
