/* eslint-disable @typescript-eslint/no-explicit-any */
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

  it('returns false for invalid SHA-256 hash (wrong length)', () => {
    const shortHash = 'a3b381c4'
    const longHash = 'a3b381c4832a4a84d2620a23ebb2bf4417a59b1a6eb3ae557a4e5b3b77ef7e5401234567'
    expect(isSHA256Hash(shortHash)).toBe(false)
    expect(isSHA256Hash(longHash)).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isSHA256Hash('')).toBe(false)
  })

  it('returns false for non-string inputs', () => {
    expect(isSHA256Hash(123 as any)).toBe(false)
    expect(isSHA256Hash(null as any)).toBe(false)
    expect(isSHA256Hash(undefined as any)).toBe(false)
    expect(isSHA256Hash({} as any)).toBe(false)
    expect(isSHA256Hash([] as any)).toBe(false)
  })
})
