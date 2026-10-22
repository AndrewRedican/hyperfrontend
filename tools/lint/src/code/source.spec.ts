import type { Node } from './model.ts'
import { describe, expect, it } from '@hyperfrontend/testing'
import { lineMap } from '../text/lines.ts'
import { parseCode } from './parse.ts'
import { commentsBetween, isParenthesised, tokenAfter, tokenBefore, tokenText, tokensBetween } from './source.ts'

const TEXT = 'const a = (b) /* c */ + 1\n'
const parsed = parseCode(TEXT, '.ts')
const program = parsed.tree as Node
const file = { path: '/w/a.ts', root: '/w', relativePath: 'a.ts', text: TEXT, lines: lineMap(TEXT), comments: parsed.comments }
const declarator = ((program.body as Node[])[0] as Node).declarations?.[0] as Node
const binary = declarator.init as Node
const b = binary.left as Node

describe('tokenBefore', () => {
  it('answers the token ending before an offset', () => {
    expect(tokenText(file, tokenBefore(program, b.start) as never)).toBe('(')
  })

  it('answers null before the first token', () => {
    expect(tokenBefore(program, 0)).toBeNull()
  })

  it('answers null when the offset splits the only token before it', () => {
    expect(tokenBefore(program, 3)).toBeNull()
  })
})

describe('tokenAfter', () => {
  it('answers the token starting at or after an offset', () => {
    expect(tokenText(file, tokenAfter(program, b.end) as never)).toBe(')')
  })

  it('answers null after the last token', () => {
    expect(tokenAfter(program, TEXT.length)).toBeNull()
  })
})

describe('tokensBetween', () => {
  it('answers the tokens inside a span', () => {
    expect(tokensBetween(program, declarator.start, binary.end).map((token) => tokenText(file, token))).toEqual([
      'a',
      '=',
      '(',
      'b',
      ')',
      '+',
      '1',
    ])
  })
})

describe('commentsBetween', () => {
  it('answers the comments inside a span', () => {
    expect(commentsBetween(file, binary.start, binary.end).map((comment) => comment.text)).toEqual([' c '])
  })

  it('leaves a comment outside the span', () => {
    expect(commentsBetween(file, 0, b.end)).toEqual([])
  })
})

describe('isParenthesised', () => {
  it('is true for a node between parentheses', () => {
    expect(isParenthesised(program, file, b)).toBe(true)
  })

  it('is false for a node without them', () => {
    expect(isParenthesised(program, file, binary)).toBe(false)
  })

  it('is false for the first node of the text', () => {
    expect(isParenthesised(program, file, program)).toBe(false)
  })
})
