import { describe, expect, it } from '@hyperfrontend/testing'
import { parseJsonSource } from './parse-json'

describe('parseJsonSource', () => {
  describe('literals', () => {
    it('parses a string with its raw text and span', () => {
      expect(parseJsonSource('"abc"').root).toEqual({ kind: 'string', value: 'abc', raw: '"abc"', start: 0, end: 5 })
    })

    it('decodes the single-character escapes', () => {
      expect(parseJsonSource('"\\"\\\\\\/\\b\\f\\n\\r\\t"').root).toMatchObject({ value: '"\\/\b\f\n\r\t' })
    })

    it('decodes a unicode escape', () => {
      expect(parseJsonSource('"\\u00e9"').root).toMatchObject({ value: 'é' })
    })

    it('parses an integer', () => {
      expect(parseJsonSource('42').root).toEqual({ kind: 'number', value: 42, raw: '42', start: 0, end: 2 })
    })

    it('parses zero', () => {
      expect(parseJsonSource('0').root).toMatchObject({ value: 0, raw: '0' })
    })

    it('parses a negative fraction with a signed exponent', () => {
      expect(parseJsonSource('-1.5e+3').root).toMatchObject({ value: -1500, raw: '-1.5e+3' })
    })

    it('parses an unsigned exponent', () => {
      expect(parseJsonSource('2E3').root).toMatchObject({ value: 2000, raw: '2E3' })
    })

    it('ends a number before a dot that no digit follows', () => {
      expect(parseJsonSource('1.').error).toEqual({ message: 'Unexpected content after the document', offset: 1 })
    })

    it('ends a number before an exponent marker that no digit follows', () => {
      expect(parseJsonSource('1e-').error).toEqual({ message: 'Unexpected content after the document', offset: 1 })
    })

    it('parses true', () => {
      expect(parseJsonSource('true').root).toEqual({ kind: 'boolean', value: true, raw: 'true', start: 0, end: 4 })
    })

    it('parses false', () => {
      expect(parseJsonSource('false').root).toMatchObject({ kind: 'boolean', value: false })
    })

    it('parses null', () => {
      expect(parseJsonSource('null').root).toEqual({ kind: 'null', value: null, raw: 'null', start: 0, end: 4 })
    })
  })

  describe('objects and arrays', () => {
    it('parses an empty object', () => {
      expect(parseJsonSource('{}').root).toEqual({ kind: 'object', properties: [], start: 0, end: 2 })
    })

    it('parses properties with the spans of their keys and values', () => {
      expect(parseJsonSource('{ "a": 1, "b": [true] }').root).toEqual({
        kind: 'object',
        start: 0,
        end: 23,
        properties: [
          {
            kind: 'property',
            start: 2,
            end: 8,
            key: { kind: 'string', value: 'a', raw: '"a"', start: 2, end: 5 },
            value: { kind: 'number', value: 1, raw: '1', start: 7, end: 8 },
          },
          {
            kind: 'property',
            start: 10,
            end: 21,
            key: { kind: 'string', value: 'b', raw: '"b"', start: 10, end: 13 },
            value: { kind: 'array', start: 15, end: 21, elements: [{ kind: 'boolean', value: true, raw: 'true', start: 16, end: 20 }] },
          },
        ],
      })
    })

    it('parses an empty array', () => {
      expect(parseJsonSource('[]').root).toEqual({ kind: 'array', elements: [], start: 0, end: 2 })
    })

    it('parses nested arrays', () => {
      expect(parseJsonSource('[[1], [2, 3]]').root).toMatchObject({
        elements: [{ elements: [{ value: 1 }] }, { elements: [{ value: 2 }, { value: 3 }] }],
      })
    })

    it('accepts a trailing comma in an object', () => {
      expect(parseJsonSource('{"a": 1,}').root).toMatchObject({ properties: [{ key: { value: 'a' } }] })
    })

    it('accepts a trailing comma in an array', () => {
      expect(parseJsonSource('[1,]').root).toMatchObject({ elements: [{ value: 1 }] })
    })
  })

  describe('trivia', () => {
    it('ignores surrounding whitespace', () => {
      expect(parseJsonSource(' \t\r\n1\n').root).toMatchObject({ value: 1, start: 4, end: 5 })
    })

    it('records line comments', () => {
      expect(parseJsonSource('// head\n1 // tail').comments).toEqual([
        { start: 0, end: 7 },
        { start: 10, end: 17 },
      ])
    })

    it('records block comments', () => {
      expect(parseJsonSource('/* a */ [1 /* b */]').comments).toEqual([
        { start: 0, end: 7 },
        { start: 11, end: 18 },
      ])
    })

    it('reports an unterminated block comment', () => {
      expect(parseJsonSource('1 /* open').error).toEqual({ message: 'Unterminated block comment', offset: 2 })
    })
  })

  describe('errors', () => {
    it('reports an empty document', () => {
      expect(parseJsonSource('  ')).toEqual({ root: null, comments: [], error: { message: 'Unexpected end of document', offset: 2 } })
    })

    it('reports content after the document', () => {
      expect(parseJsonSource('1 2').error).toEqual({ message: 'Unexpected content after the document', offset: 2 })
    })

    it('reports an unexpected character', () => {
      expect(parseJsonSource('@').error).toEqual({ message: 'Unexpected character @', offset: 0 })
    })

    it('reports a property without a name', () => {
      expect(parseJsonSource('{1: 2}').error).toEqual({ message: 'Expected a property name', offset: 1 })
    })

    it('reports a property without a colon', () => {
      expect(parseJsonSource('{"a" 1}').error).toEqual({ message: 'Expected a colon after the property name', offset: 5 })
    })

    it('reports a property without a separator', () => {
      expect(parseJsonSource('{"a": 1 "b": 2}').error).toEqual({ message: 'Expected a comma or a closing brace', offset: 8 })
    })

    it('reports an element without a separator', () => {
      expect(parseJsonSource('[1 2]').error).toEqual({ message: 'Expected a comma or a closing bracket', offset: 3 })
    })

    it('reports an unterminated string', () => {
      expect(parseJsonSource('"abc').error).toEqual({ message: 'Unterminated string', offset: 4 })
    })

    it('reports a control character in a string', () => {
      expect(parseJsonSource('"a\nb"').error).toEqual({ message: 'Control character in a string', offset: 2 })
    })

    it('reports an invalid escape', () => {
      expect(parseJsonSource('"\\x"').error).toEqual({ message: 'Invalid escape sequence', offset: 1 })
    })

    it('reports a backslash at the end of the text', () => {
      expect(parseJsonSource('"\\').error).toEqual({ message: 'Invalid escape sequence', offset: 1 })
    })

    it('reports a short unicode escape', () => {
      expect(parseJsonSource('"\\u12"').error).toEqual({ message: 'Invalid unicode escape', offset: 1 })
    })

    it('reports a lone minus sign', () => {
      expect(parseJsonSource('-').error).toEqual({ message: 'Invalid number', offset: 0 })
    })

    it('reports a misspelt literal word', () => {
      expect(parseJsonSource('nul').error).toEqual({ message: 'Unexpected character n', offset: 0 })
    })

    it('keeps the comments found before the error', () => {
      expect(parseJsonSource('// note\n@').comments).toEqual([{ start: 0, end: 7 }])
    })
  })
})
