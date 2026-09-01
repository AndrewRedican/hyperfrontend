import { describe, expect, it as test } from '@hyperfrontend/testing'
import { isValidSubscriptions } from './is-valid-subscriptions'

describe('isValidSubscriptions', () => {
  test('returns true if subscriptions is a WeakMap', () => {
    expect(isValidSubscriptions(new WeakMap())).toBe(true)
  })

  test('returns false if subscriptions is not a WeakMap', () => {
    expect(isValidSubscriptions([])).toBe(false)
    expect(isValidSubscriptions({})).toBe(false)
    expect(isValidSubscriptions(null)).toBe(false)
    expect(isValidSubscriptions(undefined)).toBe(false)
  })

  test('returns false for other data types', () => {
    expect(isValidSubscriptions(42)).toBe(false)
    expect(isValidSubscriptions('not a WeakMap')).toBe(false)
    expect(isValidSubscriptions(Symbol('not a WeakMap'))).toBe(false)
  })
})
