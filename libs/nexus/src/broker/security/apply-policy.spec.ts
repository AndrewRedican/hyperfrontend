/**
 * Tests for applyPolicy function
 */

import { applyPolicy } from './apply-policy'
import type { SecurityPolicy } from '../types'

describe('applyPolicy', () => {
  const createMockEvent = (origin = 'https://example.com'): MessageEvent => {
    return {
      origin,
      data: {},
      source: null,
    } as MessageEvent
  }

  it('return true when policy returns true', () => {
    const policy: SecurityPolicy = () => true
    const event = createMockEvent()

    const result = applyPolicy(policy, event)

    expect(result).toBe(true)
  })

  it('return false when policy returns false', () => {
    const policy: SecurityPolicy = () => false
    const event = createMockEvent()

    const result = applyPolicy(policy, event)

    expect(result).toBe(false)
  })

  it('coerces truthy values to true', () => {
    const policy: SecurityPolicy = () => <boolean>(<unknown>'truthy')
    const event = createMockEvent()

    const result = applyPolicy(policy, event)

    expect(result).toBe(true)
  })

  it('coerces falsy values to false', () => {
    const policy: SecurityPolicy = () => <boolean>(<unknown>0)
    const event = createMockEvent()

    const result = applyPolicy(policy, event)

    expect(result).toBe(false)
  })

  it('passs event to policy function', () => {
    const mockPolicy = jest.fn(() => true)
    const event = createMockEvent('https://test.com')

    applyPolicy(mockPolicy, event)

    expect(mockPolicy).toHaveBeenCalledWith(event)
    expect(mockPolicy).toHaveBeenCalledTimes(1)
  })

  it('return false when policy throws error', () => {
    const policy: SecurityPolicy = () => {
      throw new Error('Policy error')
    }
    const event = createMockEvent()

    const result = applyPolicy(policy, event)

    expect(result).toBe(false)
  })

  it('handles async policy that throws', () => {
    const policy: SecurityPolicy = () => {
      throw new TypeError('Invalid operation')
    }
    const event = createMockEvent()

    const result = applyPolicy(policy, event)

    expect(result).toBe(false)
  })

  it('allows origin-based filtering', () => {
    const allowedOrigins = ['https://trusted.com', 'https://example.com']
    const policy: SecurityPolicy = (event) => allowedOrigins.includes(event.origin)

    expect(applyPolicy(policy, createMockEvent('https://trusted.com'))).toBe(true)
    expect(applyPolicy(policy, createMockEvent('https://example.com'))).toBe(true)
    expect(applyPolicy(policy, createMockEvent('https://malicious.com'))).toBe(false)
  })

  it('supports complex policy logic', () => {
    const policy: SecurityPolicy = (event) => {
      const origin = event.origin
      return origin.startsWith('https://') && !origin.includes('malicious')
    }

    expect(applyPolicy(policy, createMockEvent('https://safe.com'))).toBe(true)
    expect(applyPolicy(policy, createMockEvent('http://safe.com'))).toBe(false)
    expect(applyPolicy(policy, createMockEvent('https://malicious.com'))).toBe(false)
  })
})
