import { describe, expect, it as test } from '@hyperfrontend/testing'
import { isValidSubscriptions } from './is-valid-subscriptions'

describe('isValidSubscriptions', () => {
  test('returns true if subscriptions is a WeakMap', () => {
    expect(isValidSubscriptions(new WeakMap())).toBe(true)
  })

  // note: every row is wrapped in an array because a bare array row is spread across the test's parameters.
  test.each([[[]], [{}], [null], [undefined]])('returns false if subscriptions is %p, which is not a WeakMap', (value) => {
    expect(isValidSubscriptions(value)).toBe(false)
  })

  test.each([42, 'not a WeakMap', Symbol('not a WeakMap')])('returns false for the other data type %p', (value) => {
    expect(isValidSubscriptions(value)).toBe(false)
  })
})
