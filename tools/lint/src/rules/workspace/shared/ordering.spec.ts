import type { Node } from '../../../code/model.ts'
import type { RuleFile } from '../../../engine/rule.ts'
import { describe, expect, it } from '@hyperfrontend/testing'
import { lineMap } from '../../../text/lines.ts'
import { isContiguous, rewriteRun } from './ordering.ts'

// why: a statement is only its span here; the helpers read nothing else of it.
const statement = (start: number, end: number): Node => ({ kind: 'EmptyStatement', start, end, parent: null })
const a = statement(0, 2)
const b = statement(3, 5)
const c = statement(6, 8)
const text = 'a;\nb;\nc;'
const file: RuleFile = { path: '/f.ts', root: '/', relativePath: 'f.ts', text, lines: lineMap(text), comments: [] }

describe('isContiguous', () => {
  it('accepts neighbours', () => {
    expect(isContiguous([a, b, c], [b, c])).toBe(true)
  })

  it('rejects a run with a statement between', () => {
    expect(isContiguous([a, b, c], [a, c])).toBe(false)
  })
})

describe('rewriteRun', () => {
  it('replaces the span from the first statement to the last with the new order', () => {
    expect(rewriteRun(file, [a, b, c], [c, a, b])).toEqual({ start: 0, end: 8, text: 'c;\na;\nb;' })
  })
})
