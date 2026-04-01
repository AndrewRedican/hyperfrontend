import type { SecurityPolicy } from '../types'
import { validatePolicy } from './validate-policy'

describe('validatePolicy', () => {
  it('does not throw for valid function', () => {
    const policy: SecurityPolicy = () => true
    expect(() => validatePolicy(policy)).not.toThrow()
  })

  it('does not throw for arrow function', () => {
    const policy = (event: MessageEvent) => Boolean(event.origin)
    expect(() => validatePolicy(policy)).not.toThrow()
  })

  it('does not throw for named function', () => {
    function policy() {
      return true
    }
    expect(() => validatePolicy(policy)).not.toThrow()
  })

  it('throws for non-function values', () => {
    expect(() => validatePolicy(null)).toThrow('Security policy must be a function')
    expect(() => validatePolicy(undefined)).toThrow('Security policy must be a function')
    expect(() => validatePolicy(123)).toThrow('Security policy must be a function')
    expect(() => validatePolicy('function')).toThrow('Security policy must be a function')
    expect(() => validatePolicy({})).toThrow('Security policy must be a function')
    expect(() => validatePolicy([])).toThrow('Security policy must be a function')
    expect(() => validatePolicy(true)).toThrow('Security policy must be a function')
  })

  it('provides descriptive error message', () => {
    expect(() => validatePolicy('not-a-function')).toThrow('Security policy must be a function that returns true or false.')
  })
})
