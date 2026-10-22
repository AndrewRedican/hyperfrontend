import type { JsonTreeNode } from '../../languages/json.ts'
import { parseJsonSource } from '@hyperfrontend/json-utils'
import { describe, expect, it } from '@hyperfrontend/testing'
import { lineMap } from '../../text/lines.ts'
import { indentationAt, isString, propertyOf, rootObject, stringsUnder, wholeDocument } from './json.ts'

const parsed = parseJsonSource('{"a": 1, "b": ["x", {"c": "y", "d": null}], "e": "z"}').root
const object = parsed?.kind === 'object' ? parsed : null

describe('propertyOf', () => {
  it('finds a property by name', () => {
    expect(object === null ? null : propertyOf(object, 'e')).toMatchObject({ key: { value: 'e' }, value: { value: 'z' } })
  })

  it('answers null for a name no property has', () => {
    expect(object === null ? undefined : propertyOf(object, 'nope')).toBeNull()
  })
})

describe('rootObject', () => {
  it('returns the root of an object document', () => {
    const document: JsonTreeNode = { kind: 'document', root: object as NonNullable<typeof object>, start: 0, end: 1 }
    expect(rootObject(document)).toBe(object)
  })

  it('answers null for a document that is no object', () => {
    const document: JsonTreeNode = {
      kind: 'document',
      root: { kind: 'null', value: null, raw: 'null', start: 0, end: 4 },
      start: 0,
      end: 4,
    }
    expect(rootObject(document)).toBeNull()
  })
})

describe('isString', () => {
  it('accepts a string literal', () => {
    expect(isString({ kind: 'string', value: 'a', raw: '"a"', start: 0, end: 3 })).toBe(true)
  })

  it('rejects a number', () => {
    expect(isString({ kind: 'number', value: 1, raw: '1', start: 0, end: 1 })).toBe(false)
  })
})

describe('stringsUnder', () => {
  it('collects the strings nested under a node in source order', () => {
    expect(object === null ? [] : stringsUnder(object).map((node) => node.value)).toEqual(['x', 'y', 'z'])
  })

  it('answers a string itself', () => {
    expect(stringsUnder({ kind: 'string', value: 'a', raw: '"a"', start: 0, end: 3 }).map((node) => node.value)).toEqual(['a'])
  })
})

describe('wholeDocument', () => {
  it('spans the text', () => {
    expect(
      wholeDocument({ path: '/w/a.json', root: '/w', relativePath: 'a.json', text: '{}\n', lines: lineMap('{}\n'), comments: [] })
    ).toEqual({ start: 0, end: 3 })
  })
})

describe('indentationAt', () => {
  it('returns the spaces before a node', () => {
    expect(indentationAt('{\n    "a": 1\n}', 6)).toBe('    ')
  })

  it('returns nothing for a node at the line start', () => {
    expect(indentationAt('{\n"a": 1\n}', 2)).toBe('')
  })

  it('stops at the start of the text', () => {
    expect(indentationAt('  1', 2)).toBe('  ')
  })
})
