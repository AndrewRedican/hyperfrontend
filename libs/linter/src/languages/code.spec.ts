import { describe, expect, it } from '@hyperfrontend/testing'
import { DEFAULT_LANGUAGE } from '../config/model'
import { codeLanguage } from './code'

describe('the code language', () => {
  it('parses a TypeScript file into its program with its comments', () => {
    const parsed = codeLanguage('/w/a.ts').parse('// c\nconst a = 1\n', DEFAULT_LANGUAGE)
    expect([parsed.tree?.kind, parsed.comments, parsed.error]).toEqual(['Program', [{ start: 0, end: 4, text: ' c' }], null])
  })

  it('answers the parse error of a text that does not parse', () => {
    expect(codeLanguage('/w/a.ts').parse('const = 1\n', DEFAULT_LANGUAGE).error).toEqual({ message: 'Identifier expected.', offset: 6 })
  })

  it('walks a node through its child fields', () => {
    const parsed = codeLanguage('/w/a.js').parse('a\n', DEFAULT_LANGUAGE)
    expect(
      codeLanguage('/w/a.js')
        .children(parsed.tree as never)
        .map((child) => child.kind)
    ).toEqual(['ExpressionStatement'])
  })
})
