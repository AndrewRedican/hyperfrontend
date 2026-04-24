import { omitKeys } from './omit'

describe('omitKeys', () => {
  it('drops a single listed key from the copy', () => {
    expect(omitKeys({ a: 1, b: 2 }, ['a'])).toEqual({ b: 2 })
  })

  it('drops multiple listed keys in one pass', () => {
    expect(omitKeys({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({ b: 2 })
  })

  it('returns a copy even when no keys match', () => {
    const source = { a: 1 }
    const result = omitKeys(source, <(keyof typeof source)[]>[])
    expect(result).toEqual({ a: 1 })
    expect(result).not.toBe(source)
  })
})
