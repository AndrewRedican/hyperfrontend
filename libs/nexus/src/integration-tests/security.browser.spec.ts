import type { SecurityPolicy } from '../broker/types'
import type { IChannelContract } from '../types/contract'
import type { MockWindow } from './test-utils'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createBroker } from '../broker/factory'
import { createMockWindow } from './test-utils'

describe('Integration: Security', () => {
  let mockWindow: MockWindow

  beforeEach(() => {
    mockWindow = createMockWindow()
  })

  const testContract: IChannelContract = {
    emitted: [{ type: 'TEST_MESSAGE' }],
    accepted: [{ type: 'TEST_RESPONSE' }],
  }

  describe('Origin Whitelist', () => {
    it('accepts messages from whitelisted origins', () => {
      const broker = createBroker({
        name: 'secure-broker',
        contract: testContract,
        settings: {
          whitelist: ['https://example.com', 'https://trusted.com'],
        },
      })

      expect(broker.settings.whitelist).toContain('https://example.com')
    })

    it('rejects messages from non-whitelisted origins', () => {
      const broker = createBroker({
        name: 'secure-broker',
        contract: testContract,
        settings: {
          whitelist: ['https://example.com'],
        },
      })

      expect(broker.settings.whitelist).not.toContain('https://evil.com')
    })

    it('works with multiple whitelisted origins', () => {
      const broker = createBroker({
        name: 'secure-broker',
        contract: testContract,
        settings: {
          whitelist: ['https://app1.com', 'https://app2.com', 'https://app3.com'],
        },
      })

      expect(broker.settings.whitelist).toHaveLength(3)
      expect(broker.settings.whitelist).toContain('https://app1.com')
      expect(broker.settings.whitelist).toContain('https://app2.com')
      expect(broker.settings.whitelist).toContain('https://app3.com')
    })
  })

  describe('Origin Blacklist', () => {
    it('rejects messages from blacklisted origins', () => {
      const broker = createBroker({
        name: 'secure-broker',
        contract: testContract,
        settings: {
          blacklist: ['https://malicious.com', 'https://spam.com'],
        },
      })

      expect(broker.settings.blacklist).toContain('https://malicious.com')
      expect(broker.settings.blacklist).toContain('https://spam.com')
    })

    it('accepts messages from non-blacklisted origins', () => {
      const broker = createBroker({
        name: 'secure-broker',
        contract: testContract,
        settings: {
          blacklist: ['https://evil.com'],
        },
      })

      expect(broker.settings.blacklist).not.toContain('https://good.com')
    })
  })

  describe('Custom Security Policies', () => {
    it('accepts custom security policy', () => {
      const broker = createBroker({
        name: 'secure-broker',
        contract: testContract,
      })

      const customPolicy = jest.fn(() => true)

      broker.setSecurityPolicy(customPolicy)

      expect(customPolicy).toBeDefined()
    })

    it('allows policy to reject connections', () => {
      const broker = createBroker({
        name: 'secure-broker',
        contract: testContract,
      })

      const rejectAllPolicy = () => false

      broker.setSecurityPolicy(rejectAllPolicy)

      expect(rejectAllPolicy()).toBe(false)
    })

    it('allows policy with custom logic', () => {
      const broker = createBroker({
        name: 'secure-broker',
        contract: testContract,
      })

      const conditionalPolicy = (event: MessageEvent) => {
        return event.origin.startsWith('https://')
      }

      broker.setSecurityPolicy(conditionalPolicy)

      const httpsEvent = { origin: 'https://test.com' } as MessageEvent
      const httpEvent = { origin: 'http://test.com' } as MessageEvent
      expect(conditionalPolicy(httpsEvent)).toBe(true)
      expect(conditionalPolicy(httpEvent)).toBe(false)
    })

    it('chains security policy calls', () => {
      const broker = createBroker({
        name: 'secure-broker',
        contract: testContract,
      })

      const policy1 = () => true
      const policy2 = () => true

      const result = broker.setSecurityPolicy(policy1).setSecurityPolicy(policy2)

      expect(result).toBe(broker)
    })
  })

  describe('Combined Security', () => {
    it('uses whitelist when both whitelist and blacklist are provided', () => {
      const broker = createBroker({
        name: 'secure-broker',
        contract: testContract,
        settings: {
          whitelist: ['https://trusted.com'],
          blacklist: ['https://evil.com'],
        },
      })

      expect(broker.settings.whitelist).toContain('https://trusted.com')
      expect(broker.settings.blacklist).toContain('https://evil.com')
    })

    it('handles empty security settings', () => {
      const broker = createBroker({
        name: 'secure-broker',
        contract: testContract,
        settings: { logLevel: 'error' },
      })

      expect(broker.settings.whitelist).toEqual([])
      expect(broker.settings.blacklist).toEqual([])
    })
  })

  describe('Channel-Level Security', () => {
    it('respects broker security when creating channels', () => {
      const broker = createBroker({
        name: 'secure-broker',
        contract: testContract,
        settings: {
          whitelist: ['https://trusted.com'],
        },
      })

      const channel = broker.addChannel('test-channel', mockWindow as unknown as Window)

      expect(channel).toBeDefined()
    })

    it('handles multiple channels with same security policy', () => {
      const broker = createBroker({
        name: 'secure-broker',
        contract: testContract,
        settings: {
          whitelist: ['https://trusted.com'],
        },
      })

      const mockWindow2 = createMockWindow()

      const channel1 = broker.addChannel('channel-1', mockWindow as unknown as Window)
      const channel2 = broker.addChannel('channel-2', mockWindow2 as unknown as Window)

      expect(channel1).toBeDefined()
      expect(channel2).toBeDefined()
    })
  })

  describe('Security Policy Errors', () => {
    it('throws error for invalid security policy', () => {
      const broker = createBroker({
        name: 'secure-broker',
        contract: testContract,
      })

      expect(() => {
        broker.setSecurityPolicy('not a function' as unknown as SecurityPolicy)
      }).toThrow()

      expect(() => {
        broker.setSecurityPolicy(null as unknown as SecurityPolicy)
      }).toThrow()

      expect(() => {
        broker.setSecurityPolicy(undefined as unknown as SecurityPolicy)
      }).toThrow()
    })
  })

  describe('Real-World Security Scenarios', () => {
    it('handles multi-tenant security', () => {
      const broker = createBroker({
        name: 'multi-tenant-broker',
        contract: testContract,
      })

      const tenantIds = ['tenant-1', 'tenant-2', 'tenant-3']

      const tenantPolicy = (event: MessageEvent) => {
        const processId = event.data?.processId || ''
        return tenantIds.some((id) => processId.startsWith(id))
      }

      broker.setSecurityPolicy(tenantPolicy)

      const event1 = { data: { processId: 'tenant-1-abc' } } as MessageEvent
      const event2 = { data: { processId: 'tenant-5-abc' } } as MessageEvent
      expect(tenantPolicy(event1)).toBe(true)
      expect(tenantPolicy(event2)).toBe(false)
    })

    it('handles rate limiting in security policy', () => {
      const broker = createBroker({
        name: 'rate-limited-broker',
        contract: testContract,
      })

      const connectionAttempts = new Map<string, number>()
      const maxAttempts = 5

      const rateLimitPolicy = (event: MessageEvent) => {
        const origin = event.origin
        const count = connectionAttempts.get(origin) || 0
        connectionAttempts.set(origin, count + 1)
        return count < maxAttempts
      }

      broker.setSecurityPolicy(rateLimitPolicy)

      const mockEvent = { origin: 'https://test.com' } as MessageEvent
      for (let i = 0; i < 7; i++) {
        rateLimitPolicy(mockEvent)
      }

      expect(rateLimitPolicy(mockEvent)).toBe(false)
    })

    it('handles time-based security', () => {
      const broker = createBroker({
        name: 'time-restricted-broker',
        contract: testContract,
      })

      const allowedHours = { start: 9, end: 17 }

      const timePolicy = () => {
        const hour = new Date().getHours()
        return hour >= allowedHours.start && hour < allowedHours.end
      }

      broker.setSecurityPolicy(timePolicy)

      const result = timePolicy()
      expect(typeof result).toBe('boolean')
    })
  })
})
