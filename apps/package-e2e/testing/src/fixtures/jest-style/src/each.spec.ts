import { describe, expect, it } from '@hyperfrontend/testing'

describe('it.each', () => {
  it.each([
    [1, 2, 3],
    [2, 3, 5],
  ])('adds %s and %s to make %p', (left: number, right: number, sum: number) => {
    expect.assertions(1)
    expect(left + right).toBe(sum)
  })

  it.each([['ab', 'cd', 'abcd']])('joins %s and %s into %p', (left: string, right: string, joined: string) => {
    expect(left + right).toBe(joined)
  })

  it('accepts the assertion count a test declares', () => {
    expect.assertions(2)
    expect(1).toBe(1)
    expect(2).toBe(2)
  })

  it('accepts a test that declares it asserts at all', () => {
    expect.hasAssertions()
    expect('yes').toBeDefined()
  })
})
