import { describe, expect, it } from '@hyperfrontend/testing'
import { compareText } from './compare'

describe('compareText', () => {
  it.each([
    ['a', 'b', -1],
    ['b', 'a', 1],
    ['a', 'a', 0],
    ['B', 'a', -1],
  ])('orders %s against %s', (a, b, expected) => {
    expect(compareText(a, b)).toBe(expected)
  })
})
