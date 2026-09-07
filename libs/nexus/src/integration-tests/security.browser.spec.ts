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

  const createSecureBroker = (settings: Record<string, unknown> = {}) =>
    createBroker({ name: 'secure-broker', contract: testContract, window: mockWindow as unknown as Window, settings })

  describe('Origin Whitelist', () => {
    it('records the whitelisted origins', () => {
      const broker = createSecureBroker({ whitelist: ['https://example.com', 'https://trusted.com'] })

      expect(broker.settings.whitelist).toEqual(['https://example.com', 'https://trusted.com'])
    })

    it('leaves origins outside the whitelist unlisted', () => {
      const broker = createSecureBroker({ whitelist: ['https://example.com'] })

      expect(broker.settings.whitelist).not.toContain('https://evil.com')
    })

    it('keeps every whitelisted origin when several are given', () => {
      const broker = createSecureBroker({ whitelist: ['https://app1.com', 'https://app2.com', 'https://app3.com'] })

      expect(broker.settings.whitelist).toEqual(['https://app1.com', 'https://app2.com', 'https://app3.com'])
    })
  })

  describe('Origin Blacklist', () => {
    it('records the blacklisted origins', () => {
      const broker = createSecureBroker({ blacklist: ['https://malicious.com', 'https://spam.com'] })

      expect(broker.settings.blacklist).toEqual(['https://malicious.com', 'https://spam.com'])
    })

    it('leaves origins outside the blacklist unlisted', () => {
      const broker = createSecureBroker({ blacklist: ['https://evil.com'] })

      expect(broker.settings.blacklist).not.toContain('https://good.com')
    })
  })

  describe('Custom Security Policies', () => {
    it('stores a custom security policy on the broker settings', () => {
      const broker = createSecureBroker()
      const customPolicy = jest.fn(() => true)

      broker.setSecurityPolicy(customPolicy)

      expect(broker.settings.securityPolicy).toBe(customPolicy)
    })

    it('replaces the policy when set again', () => {
      const broker = createSecureBroker()
      const rejectAllPolicy = () => false

      broker.setSecurityPolicy(() => true)
      broker.setSecurityPolicy(rejectAllPolicy)

      expect(broker.settings.securityPolicy).toBe(rejectAllPolicy)
    })

    it('accepts a policy with custom logic over the message event', () => {
      const broker = createSecureBroker()
      const conditionalPolicy = (event: MessageEvent) => event.origin.startsWith('https://')

      broker.setSecurityPolicy(conditionalPolicy)

      const httpsEvent = { origin: 'https://test.com' } as MessageEvent
      const httpEvent = { origin: 'http://test.com' } as MessageEvent
      expect([conditionalPolicy(httpsEvent), conditionalPolicy(httpEvent)]).toEqual([true, false])
    })

    it('chains security policy calls', () => {
      const broker = createSecureBroker()

      const result = broker.setSecurityPolicy(() => true).setSecurityPolicy(() => true)

      expect(result).toBe(broker)
    })
  })

  describe('Combined Security', () => {
    it('keeps both lists when whitelist and blacklist are provided', () => {
      const broker = createSecureBroker({ whitelist: ['https://trusted.com'], blacklist: ['https://evil.com'] })

      expect(broker.settings).toEqual(expect.objectContaining({ whitelist: ['https://trusted.com'], blacklist: ['https://evil.com'] }))
    })

    it('defaults both lists to empty', () => {
      const broker = createSecureBroker({ logLevel: 'error' })

      expect(broker.settings).toEqual(expect.objectContaining({ whitelist: [], blacklist: [] }))
    })
  })

  describe('Channel-Level Security', () => {
    it('creates channels under the broker security settings', () => {
      const broker = createSecureBroker({ whitelist: ['https://trusted.com'] })

      const channel = broker.addChannel('test-channel', createMockWindow() as unknown as Window)

      expect(channel.name).toBe('test-channel')
    })

    it('registers multiple channels under the same security policy', () => {
      const broker = createSecureBroker({ whitelist: ['https://trusted.com'] })

      broker.addChannel('channel-1', createMockWindow() as unknown as Window)
      broker.addChannel('channel-2', createMockWindow() as unknown as Window)

      expect(broker.channels.map((channel) => channel.name)).toEqual(['channel-1', 'channel-2'])
    })
  })

  describe('Security Policy Errors', () => {
    it('throws for every security policy that is not a function', () => {
      const broker = createSecureBroker()
      const invalidPolicies = ['not a function', null, undefined]

      const outcomes = invalidPolicies.map((policy) => {
        try {
          broker.setSecurityPolicy(policy as unknown as SecurityPolicy)
          return 'accepted'
        } catch {
          return 'thrown'
        }
      })

      expect(outcomes).toEqual(['thrown', 'thrown', 'thrown'])
    })
  })

  describe('Real-World Security Scenarios', () => {
    it('handles multi-tenant security', () => {
      const broker = createSecureBroker()
      const tenantIds = ['tenant-1', 'tenant-2', 'tenant-3']
      const tenantPolicy = (event: MessageEvent) => {
        const processId = (event.data?.processId as string | undefined) ?? ''
        return tenantIds.some((id) => processId.startsWith(id))
      }

      broker.setSecurityPolicy(tenantPolicy)

      const event1 = { data: { processId: 'tenant-1-abc' } } as MessageEvent
      const event2 = { data: { processId: 'tenant-5-abc' } } as MessageEvent
      expect([tenantPolicy(event1), tenantPolicy(event2)]).toEqual([true, false])
    })

    it('handles rate limiting in security policy', () => {
      const broker = createSecureBroker()
      const connectionAttempts = new Map<string, number>()
      const rateLimitPolicy = (event: MessageEvent) => {
        const count = connectionAttempts.get(event.origin) ?? 0
        connectionAttempts.set(event.origin, count + 1)
        // magic: five attempts per origin before the policy starts refusing.
        return count < 5
      }

      broker.setSecurityPolicy(rateLimitPolicy)

      const mockEvent = { origin: 'https://test.com' } as MessageEvent
      const verdicts = Array.from({ length: 7 }, () => rateLimitPolicy(mockEvent))
      expect(verdicts).toEqual([true, true, true, true, true, false, false])
    })

    it('handles time-based security', () => {
      const broker = createSecureBroker()
      const allowedHours = { start: 9, end: 17 }
      const timePolicy = (event: MessageEvent) => {
        const hour = (event.data as { hour: number }).hour
        return hour >= allowedHours.start && hour < allowedHours.end
      }

      broker.setSecurityPolicy(timePolicy)

      const atHour = (hour: number) => ({ data: { hour } }) as MessageEvent
      expect([timePolicy(atHour(8)), timePolicy(atHour(12)), timePolicy(atHour(17))]).toEqual([false, true, false])
    })
  })
})
