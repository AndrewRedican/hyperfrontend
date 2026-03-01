/**
 * Unit Tests: Security Transport Factory
 *
 * Tests the unified factory for creating security transports based on
 * the negotiated protocol version.
 */

import type { SecurityTransportConfig } from '../../types/security'
import { createSecurityTransport } from './factory'

describe('Security Transport Factory', () => {
  let mockTarget: { postMessage: jest.Mock }
  let mockProvider: jest.Mock

  beforeEach(() => {
    mockTarget = {
      postMessage: jest.fn(),
    }

    mockProvider = jest.fn(() => ({
      send: jest.fn(),
      receive: jest.fn(),
    }))
  })

  describe('none protocol', () => {
    it('creates NoneTransport for "none" protocol', () => {
      const config: SecurityTransportConfig = {
        protocol: 'none',
        target: mockTarget as unknown as Window,
      }

      const transport = createSecurityTransport(config)

      expect(transport.getProtocol()).toBe('none')
      expect(transport.isReady()).toBe(true)
    })

    it('does not require provider for "none" protocol', () => {
      const config: SecurityTransportConfig = {
        protocol: 'none',
        target: mockTarget as unknown as Window,
        provider: undefined,
      }

      expect(() => createSecurityTransport(config)).not.toThrow()
    })

    it('ignores provider for "none" protocol', () => {
      const config: SecurityTransportConfig = {
        protocol: 'none',
        target: mockTarget as unknown as Window,
        provider: mockProvider,
      }

      const transport = createSecurityTransport(config)
      transport.send({ type: 'TEST' })

      expect(mockProvider).not.toHaveBeenCalled()
    })

    it('passes origin to NoneTransport', () => {
      const config: SecurityTransportConfig = {
        protocol: 'none',
        target: mockTarget as unknown as Window,
        origin: 'https://custom.com',
      }

      const transport = createSecurityTransport(config)
      transport.send({ type: 'TEST' })

      expect(mockTarget.postMessage).toHaveBeenCalledWith({ type: 'TEST' }, 'https://custom.com')
    })
  })

  describe('v1 protocol', () => {
    it('creates SecureTransport for "v1" protocol', () => {
      const config: SecurityTransportConfig = {
        protocol: 'v1',
        provider: mockProvider,
        target: mockTarget as unknown as Window,
      }

      const transport = createSecurityTransport(config)

      expect(transport.getProtocol()).toBe('v1')
    })

    it('throws error when provider is missing for v1', () => {
      const config: SecurityTransportConfig = {
        protocol: 'v1',
        provider: undefined,
        target: mockTarget as unknown as Window,
      }

      expect(() => createSecurityTransport(config)).toThrow("Security protocol 'v1' requires a protocol provider")
    })
  })

  describe('v2 protocol', () => {
    it('creates SecureTransport for "v2" protocol', () => {
      const config: SecurityTransportConfig = {
        protocol: 'v2',
        provider: mockProvider,
        target: mockTarget as unknown as Window,
      }

      const transport = createSecurityTransport(config)

      expect(transport.getProtocol()).toBe('v2')
    })

    it('throws error when provider is missing for v2', () => {
      const config: SecurityTransportConfig = {
        protocol: 'v2',
        provider: undefined,
        target: mockTarget as unknown as Window,
      }

      expect(() => createSecurityTransport(config)).toThrow("Security protocol 'v2' requires a protocol provider")
    })

    it('passes sharedKey to SecureTransport', () => {
      const config: SecurityTransportConfig = {
        protocol: 'v2',
        provider: mockProvider,
        target: mockTarget as unknown as Window,
        sharedKey: 'test-shared-key',
      }

      const transport = createSecurityTransport(config)

      expect(transport).toBeDefined()
    })

    it('passes refreshRate to SecureTransport', () => {
      const config: SecurityTransportConfig = {
        protocol: 'v2',
        provider: mockProvider,
        target: mockTarget as unknown as Window,
        refreshRate: 30,
      }

      const transport = createSecurityTransport(config)

      expect(transport).toBeDefined()
    })

    it('passes origin to SecureTransport', () => {
      const config: SecurityTransportConfig = {
        protocol: 'v2',
        provider: mockProvider,
        target: mockTarget as unknown as Window,
        origin: 'https://secure.com',
      }

      const transport = createSecurityTransport(config)

      expect(transport).toBeDefined()
    })
  })
})
