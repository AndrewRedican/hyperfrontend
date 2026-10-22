import { describe, expect, it } from '@hyperfrontend/testing'
import { DEFAULT_LANGUAGE } from '../config/model.ts'
import { jsonLanguage } from './json.ts'

describe('jsonLanguage.parse', () => {
  it('wraps the root value in a document node', () => {
    expect(jsonLanguage.parse('{"a": 1}', DEFAULT_LANGUAGE).tree).toMatchObject({
      kind: 'document',
      start: 0,
      end: 8,
      root: { kind: 'object' },
    })
  })

  it('strips the delimiters of a line comment', () => {
    expect(jsonLanguage.parse('// lint-disable\n1', DEFAULT_LANGUAGE).comments).toEqual([{ start: 0, end: 15, text: ' lint-disable' }])
  })

  it('strips the delimiters of a block comment', () => {
    expect(jsonLanguage.parse('/* note */ 1', DEFAULT_LANGUAGE).comments).toEqual([{ start: 0, end: 10, text: ' note ' }])
  })

  it('reports a malformed document', () => {
    expect(jsonLanguage.parse('{', DEFAULT_LANGUAGE)).toEqual({
      tree: null,
      comments: [],
      error: { message: 'Expected a property name', offset: 1 },
    })
  })
})

describe('jsonLanguage.children', () => {
  const parsed = jsonLanguage.parse('{"a": [1, true]}', DEFAULT_LANGUAGE)
  const document = parsed.tree
  const object = document?.kind === 'document' ? document.root : null
  const property = object?.kind === 'object' ? object.properties[0] : null
  const array = property?.value

  it('descends from the document to its root', () => {
    expect(document === null ? [] : jsonLanguage.children(document)).toEqual([object])
  })

  it('descends from an object to its properties', () => {
    expect(object === null ? [] : jsonLanguage.children(object)).toEqual([property])
  })

  it('descends from a property to its key and value', () => {
    expect(property === null ? [] : jsonLanguage.children(property).map((node) => node.kind)).toEqual(['string', 'array'])
  })

  it('descends from an array to its elements', () => {
    expect(array === undefined ? [] : jsonLanguage.children(array).map((node) => node.kind)).toEqual(['number', 'boolean'])
  })

  it('finds no children under a literal', () => {
    expect(jsonLanguage.children({ kind: 'null', value: null, raw: 'null', start: 0, end: 4 })).toEqual([])
  })
})
