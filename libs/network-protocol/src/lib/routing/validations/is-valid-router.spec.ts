import { describe, expect, it } from '@hyperfrontend/testing'
import { router } from '../creators/mocks'
import { isValidRouter } from './is-valid-router'

describe('isValidRouter', () => {
  it('returns true for function', () => {
    expect(isValidRouter(router)).toBe(true)
  })

  // note: every row is wrapped in an array because a bare array row is spread across the test's parameters.
  it.each([[void 0], [null], [94], [{}], [[]], [() => new WeakSet()]])('returns false for %p, which is not a router', (value) => {
    expect(isValidRouter(value)).toBe(false)
  })
})
