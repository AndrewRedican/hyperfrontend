import { describe, expect, it } from '@hyperfrontend/testing'
import { isSHA256Hash } from './is-sha-256-hash'

describe('isSHA256Hash', () => {
  it('returns true for valid SHA-256 hash', () => {
    const validHash = 'a3b381c4832a4a84d2620a23ebb2bf4417a59b1a6eb3ae557a4e5b3b77ef7e54'
    expect(isSHA256Hash(validHash)).toBe(true)
  })

  it('returns false for invalid SHA-256 hash (wrong characters)', () => {
    const invalidHash = 'z3b381c4832a4a84d2620a23ebb2bf4417a59b1a6eb3ae557a4e5b3b77ef7e54'
    expect(isSHA256Hash(invalidHash)).toBe(false)
  })

  it('returns false for invalid SHA-256 hash (too short)', () => {
    const shortHash = 'a3b381c4'
    expect(isSHA256Hash(shortHash)).toBe(false)
  })

  it('returns false for invalid SHA-256 hash (too long)', () => {
    const longHash = 'a3b381c4832a4a84d2620a23ebb2bf4417a59b1a6eb3ae557a4e5b3b77ef7e5401234567'
    expect(isSHA256Hash(longHash)).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isSHA256Hash('')).toBe(false)
  })

  // note: each row is wrapped in an array because .each spreads an array row into arguments, which would turn the [] input into no argument at all.
  it.each([[123], [null], [undefined], [{}], [[]]])('returns false for the non-string input %p', (input: unknown) => {
    expect(isSHA256Hash(input)).toBe(false)
  })
})
