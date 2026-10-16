import type { Logger } from '@hyperfrontend/logging'
import type { SecurityPolicy } from '../types'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { applyPolicy } from './apply-policy'

describe('applyPolicy', () => {
  let mockLogger: Logger

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      setLogLevel: jest.fn(),
      getLogLevel: jest.fn(() => 'debug'),
    }
  })

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

    const result = applyPolicy(policy, event, mockLogger)

    expect(result).toBe(true)
  })

  it('return false when policy returns false', () => {
    const policy: SecurityPolicy = () => false
    const event = createMockEvent()

    const result = applyPolicy(policy, event, mockLogger)

    expect(result).toBe(false)
  })

  it('coerces truthy values to true', () => {
    const policy: SecurityPolicy = () => 'truthy' as unknown as boolean
    const event = createMockEvent()

    const result = applyPolicy(policy, event, mockLogger)

    expect(result).toBe(true)
  })

  it('coerces falsy values to false', () => {
    const policy: SecurityPolicy = () => 0 as unknown as boolean
    const event = createMockEvent()

    const result = applyPolicy(policy, event, mockLogger)

    expect(result).toBe(false)
  })

  it('passes the event to the policy function once', () => {
    const mockPolicy = jest.fn(() => true)
    const event = createMockEvent('https://test.com')

    applyPolicy(mockPolicy, event, mockLogger)

    expect(mockPolicy.mock.calls).toEqual([[event]])
  })

  it('returns false when the policy throws', () => {
    const policy: SecurityPolicy = () => {
      throw new Error('Policy error')
    }
    const event = createMockEvent()

    const result = applyPolicy(policy, event, mockLogger)

    expect(result).toBe(false)
  })

  it('returns false when the policy throws a TypeError', () => {
    const policy: SecurityPolicy = () => {
      throw new TypeError('Invalid operation')
    }
    const event = createMockEvent()

    const result = applyPolicy(policy, event, mockLogger)

    expect(result).toBe(false)
  })

  it('logs a TypeError thrown by the policy', () => {
    const policy: SecurityPolicy = () => {
      throw new TypeError('Invalid operation')
    }
    const event = createMockEvent()

    applyPolicy(policy, event, mockLogger)

    expect(mockLogger.error).toHaveBeenCalledWith('Security policy threw an error:', expect.any(TypeError))
  })

  it('allows origin-based filtering', () => {
    const allowedOrigins = ['https://trusted.com', 'https://example.com']
    const policy: SecurityPolicy = (event) => allowedOrigins.includes(event.origin)
    const origins = ['https://trusted.com', 'https://example.com', 'https://malicious.com']

    expect(origins.map((origin) => [origin, applyPolicy(policy, createMockEvent(origin), mockLogger)])).toEqual([
      ['https://trusted.com', true],
      ['https://example.com', true],
      ['https://malicious.com', false],
    ])
  })

  it('supports complex policy logic', () => {
    const policy: SecurityPolicy = (event) => {
      const origin = event.origin
      return origin.startsWith('https://') && !origin.includes('malicious')
    }
    const origins = ['https://safe.com', 'http://safe.com', 'https://malicious.com']

    expect(origins.map((origin) => [origin, applyPolicy(policy, createMockEvent(origin), mockLogger)])).toEqual([
      ['https://safe.com', true],
      ['http://safe.com', false],
      ['https://malicious.com', false],
    ])
  })

  it('logs error when policy throws', () => {
    const policy: SecurityPolicy = () => {
      throw new Error('Production error')
    }
    const event = createMockEvent()

    applyPolicy(policy, event, mockLogger)

    expect(mockLogger.error).toHaveBeenCalledWith('Security policy threw an error:', expect.any(Error))
  })
})
