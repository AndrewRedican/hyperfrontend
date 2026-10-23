import { describe, expect, it } from '@hyperfrontend/testing'
import { mergeEdits } from './edits'

describe('mergeEdits', () => {
  it('folds an insertion and a removal into one replacement', () => {
    expect(
      mergeEdits('import A, { B } from "x"', [
        { start: 6, end: 6, text: ' type' },
        { start: 8, end: 15, text: '' },
      ])
    ).toEqual({ start: 6, end: 15, text: ' type A' })
  })

  it('keeps the text between edits given out of order', () => {
    expect(
      mergeEdits('abcdef', [
        { start: 4, end: 5, text: 'E' },
        { start: 1, end: 2, text: 'B' },
      ])
    ).toEqual({ start: 1, end: 5, text: 'BcdE' })
  })

  it('keeps two insertions at one offset in the order given', () => {
    expect(
      mergeEdits('ab', [
        { start: 1, end: 1, text: 'X' },
        { start: 1, end: 1, text: 'Y' },
      ])
    ).toEqual({ start: 1, end: 1, text: 'XY' })
  })
})
