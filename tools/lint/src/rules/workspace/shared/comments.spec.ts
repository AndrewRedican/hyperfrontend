import type { RuleFile } from '../../../engine/rule.ts'
import { describe, expect, it } from '@hyperfrontend/testing'
import { lineMap } from '../../../text/lines.ts'
import { commentKind, isJsdocComment, isLineComment, isOwnLine } from './comments.ts'

// why: a file whose only content is the text given, with one comment spanning the offsets named.
const fileOf = (text: string): RuleFile => ({ path: '/f.ts', root: '/', relativePath: 'f.ts', text, lines: lineMap(text), comments: [] })

describe('commentKind', () => {
  it('names a line comment', () => {
    expect(commentKind(fileOf('// a'), { start: 0, end: 4, text: ' a' })).toBe('line')
  })

  it('names a plain block comment', () => {
    expect(commentKind(fileOf('/* a */'), { start: 0, end: 7, text: ' a ' })).toBe('block')
  })

  it('names a JSDoc block', () => {
    expect(commentKind(fileOf('/** a */'), { start: 0, end: 8, text: '* a ' })).toBe('jsdoc')
  })
})

describe('isLineComment', () => {
  it('accepts a line comment', () => {
    expect(isLineComment(fileOf('// a'), { start: 0, end: 4, text: ' a' })).toBe(true)
  })

  it('rejects a block comment', () => {
    expect(isLineComment(fileOf('/* a */'), { start: 0, end: 7, text: ' a ' })).toBe(false)
  })
})

describe('isJsdocComment', () => {
  it('accepts a JSDoc block', () => {
    expect(isJsdocComment(fileOf('/** a */'), { start: 0, end: 8, text: '* a ' })).toBe(true)
  })

  it('rejects a plain block comment', () => {
    expect(isJsdocComment(fileOf('/* a */'), { start: 0, end: 7, text: ' a ' })).toBe(false)
  })
})

describe('isOwnLine', () => {
  it('accepts a comment at the start of the file', () => {
    expect(isOwnLine(fileOf('// a'), { start: 0, end: 4, text: ' a' })).toBe(true)
  })

  it('accepts an indented comment on its own line', () => {
    expect(isOwnLine(fileOf('x\n\t // a'), { start: 4, end: 8, text: ' a' })).toBe(true)
  })

  it('rejects a comment after code', () => {
    expect(isOwnLine(fileOf('x // a'), { start: 2, end: 6, text: ' a' })).toBe(false)
  })
})
