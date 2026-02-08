import { router } from '../creators/mocks'
import { isValidRouter } from './is-valid-router'

describe('isValidRouter', () => {
  it('returns true for function', () => {
    expect(isValidRouter(router)).toBe(true)
  })

  it('returns false for anything other than function', () => {
    expect(isValidRouter(void 0)).toBe(false)
    expect(isValidRouter(null)).toBe(false)
    expect(isValidRouter(94)).toBe(false)
    expect(isValidRouter({})).toBe(false)
    expect(isValidRouter([])).toBe(false)
    expect(isValidRouter(() => new WeakSet())).toBe(false)
  })
})
