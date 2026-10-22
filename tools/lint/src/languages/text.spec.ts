import { describe, expect, it } from '@hyperfrontend/testing'
import { DEFAULT_LANGUAGE } from '../config/model.ts'
import { textLanguage } from './text.ts'

describe('the text language', () => {
  it('wraps a text as one document node spanning it', () => {
    expect(textLanguage.parse('a: 1\n', DEFAULT_LANGUAGE)).toEqual({
      tree: { kind: 'document', start: 0, end: 5 },
      comments: [],
      error: null,
    })
  })

  it('gives the document no children', () => {
    expect(textLanguage.children({ kind: 'document', start: 0, end: 5 })).toEqual([])
  })
})
