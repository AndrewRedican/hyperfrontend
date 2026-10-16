import { describe, expect, it } from '@hyperfrontend/testing'
import { isValidSequence } from './is-valid-schema-sequence'

describe('isValidSequence', () => {
  it.each([1, 234])('returns true for the valid sequence %p', (sequence) => {
    expect(isValidSequence(sequence)).toBe(true)
  })

  it.each([void 0, null, 0, -5, {}, '14'])('returns false for the invalid sequence %p', (value) => {
    expect(isValidSequence(value)).toBe(false)
  })
})
