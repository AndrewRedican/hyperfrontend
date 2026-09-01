import { describe, expect, it } from '@hyperfrontend/testing'
import { toSourceLiteral } from './source-literal'

describe('toSourceLiteral', () => {
  it('renders null', () => {
    expect(toSourceLiteral(null)).toBe('null')
  })

  it('renders a number', () => {
    expect(toSourceLiteral(42)).toBe('42')
  })

  it('renders a boolean', () => {
    expect(toSourceLiteral(false)).toBe('false')
  })

  it('renders a plain string single-quoted', () => {
    expect(toSourceLiteral('clock')).toBe("'clock'")
  })

  it('leaves embedded double quotes bare inside a single-quoted string', () => {
    expect(toSourceLiteral('he said "hi"')).toBe('\'he said "hi"\'')
  })

  it('escapes embedded single quotes', () => {
    expect(toSourceLiteral("it's")).toBe("'it\\'s'")
  })

  it('escapes a lone backslash', () => {
    expect(toSourceLiteral('a\\b')).toBe("'a\\\\b'")
  })

  it('preserves a newline as its escape sequence', () => {
    expect(toSourceLiteral('a\nb')).toBe("'a\\nb'")
  })

  it('handles a backslash immediately followed by a double quote', () => {
    expect(toSourceLiteral('\\"')).toBe("'\\\\\"'")
  })

  it('renders an empty array', () => {
    expect(toSourceLiteral([])).toBe('[]')
  })

  it('renders an empty object', () => {
    expect(toSourceLiteral({})).toBe('{}')
  })

  it('renders an array with indentation and a trailing comma', () => {
    expect(toSourceLiteral([1, 2])).toBe('[\n  1,\n  2,\n]')
  })

  it('leaves valid identifier keys unquoted', () => {
    expect(toSourceLiteral({ name: 'clock' })).toBe("{\n  name: 'clock',\n}")
  })

  it('leaves a key with trailing digits unquoted', () => {
    expect(toSourceLiteral({ a1: 2 })).toBe('{\n  a1: 2,\n}')
  })

  it('quotes keys that are not valid identifiers', () => {
    expect(toSourceLiteral({ 'data-id': 1 })).toBe("{\n  'data-id': 1,\n}")
  })

  it('quotes an empty key', () => {
    expect(toSourceLiteral({ '': 1 })).toBe("{\n  '': 1,\n}")
  })

  it('quotes a key that starts with a non-identifier character', () => {
    expect(toSourceLiteral({ '1a': 2 })).toBe("{\n  '1a': 2,\n}")
  })

  it('drops undefined object members like JSON', () => {
    expect(toSourceLiteral({ a: undefined, b: 1 })).toBe('{\n  b: 1,\n}')
  })

  it('indents nested structures', () => {
    expect(toSourceLiteral({ accepted: [{ type: 'x' }] })).toBe("{\n  accepted: [\n    {\n      type: 'x',\n    },\n  ],\n}")
  })
})
