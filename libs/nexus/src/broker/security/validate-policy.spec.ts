import type { SecurityPolicy } from '../types'
import { describe, expect, it } from '@hyperfrontend/testing'
import { validatePolicy } from './validate-policy'

describe('validatePolicy', () => {
  const nonFunctions: readonly [string, unknown][] = [
    ['null', null],
    ['undefined', undefined],
    ['a number', 123],
    ['a string', 'function'],
    ['an object', {}],
    ['an array', []],
    ['a boolean', true],
  ]

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

  it.each(nonFunctions)('throws when the policy is %s', (_label: string, policy: unknown) => {
    expect(() => validatePolicy(policy)).toThrow('Security policy must be a function')
  })

  it('provides descriptive error message', () => {
    expect(() => validatePolicy('not-a-function')).toThrow('Security policy must be a function that returns true or false.')
  })
})
