import { describe, expect, it } from '@hyperfrontend/testing'
import { applyFixes } from './fix.ts'

describe('applyFixes', () => {
  it('leaves a text without fixes', () => {
    expect(applyFixes('abc', [])).toEqual({ text: 'abc', applied: 0 })
  })

  it('replaces a span', () => {
    expect(applyFixes('var x', [{ start: 0, end: 3, text: 'let' }])).toEqual({ text: 'let x', applied: 1 })
  })

  it('applies fixes in source order whatever their order', () => {
    expect(
      applyFixes('a b c', [
        { start: 4, end: 5, text: 'C' },
        { start: 0, end: 1, text: 'A' },
      ])
    ).toEqual({ text: 'A b C', applied: 2 })
  })

  it('skips a fix that overlaps an earlier one', () => {
    expect(
      applyFixes('abcdef', [
        { start: 0, end: 3, text: 'X' },
        { start: 2, end: 4, text: 'Y' },
      ])
    ).toEqual({ text: 'Xdef', applied: 1 })
  })

  it('inserts at an empty span', () => {
    expect(applyFixes('ab', [{ start: 1, end: 1, text: '-' }])).toEqual({ text: 'a-b', applied: 1 })
  })

  it('defers a fix that starts where the earlier one ends', () => {
    expect(
      applyFixes('abcdef', [
        { start: 0, end: 3, text: 'X' },
        { start: 3, end: 4, text: 'Y' },
      ])
    ).toEqual({ text: 'Xdef', applied: 1 })
  })

  it('defers the second of two insertions at one offset', () => {
    expect(
      applyFixes('ab', [
        { start: 0, end: 0, text: '1' },
        { start: 0, end: 0, text: '2' },
      ])
    ).toEqual({ text: '1ab', applied: 1 })
  })
})
