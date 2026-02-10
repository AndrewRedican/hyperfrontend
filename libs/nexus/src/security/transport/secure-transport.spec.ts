/**
 * Unit Tests: SecureTransport
 *
 * Tests the secure transport implementation that wraps network-protocol's
 * encryption and obfuscation pipeline.
 */

import { createSecureTransport } from './secure-transport'
import type { SecurityTransport } from '../../types/security'
import type { SecureTransportConfig } from './types'

describe('SecureTransport', () => {
  let mockTarget: { postMessage: jest.Mock }
  let mockNetworkProtocol: {
    send: jest.Mock
    receive: jest.Mock
  }
  let mockProvider: jest.Mock
  let capturedSendPacket: ((packet: Uint8Array) => void) | null
  let capturedReceivePacket: ((packet: { origin: string; target: string; data: unknown }) => void) | null

  beforeEach(() => {
    mockTarget = {
      postMessage: jest.fn(),
    }

    mockNetworkProtocol = {
      send: jest.fn(),
      receive: jest.fn(),
    }

    capturedSendPacket = null
    capturedReceivePacket = null

    mockProvider = jest.fn((sendPacket, receivePacket) => {
      capturedSendPacket = sendPacket
      capturedReceivePacket = receivePacket
      return mockNetworkProtocol
    })
  })

  const createTransport = (
    overrides: Partial<SecureTransportConfig> = {}
  ): SecurityTransport & { handleReceive: (packet: Uint8Array) => void } => {
    return createSecureTransport({
      protocol: 'v2',
      provider: mockProvider,
      target: mockTarget as unknown as Window,
      ...overrides,
    }) as SecurityTransport & { handleReceive: (packet: Uint8Array) => void }
  }

  describe('initialization', () => {
    it('throws error when provider is missing', () => {
      expect(() => {
        createSecureTransport({
          protocol: 'v2',
          provider: undefined,
          target: mockTarget as unknown as Window,
        })
      }).toThrow('SecureTransport requires a protocol provider for v2')
    })

    it('accepts v1 protocol', () => {
      const transport = createTransport({ protocol: 'v1' })
      expect(transport.getProtocol()).toBe('v1')
    })

    it('accepts v2 protocol', () => {
      const transport = createTransport({ protocol: 'v2' })
      expect(transport.getProtocol()).toBe('v2')
    })

    it('does not initialize protocol until send or onReceive is called', () => {
      createTransport()
      expect(mockProvider).not.toHaveBeenCalled()
    })

    it('initializes protocol on first send', () => {
      const transport = createTransport()
      transport.send({ type: 'TEST' })
      expect(mockProvider).toHaveBeenCalledTimes(1)
    })

    it('initializes protocol on onReceive registration', () => {
      const transport = createTransport()
      transport.onReceive(() => void 0)
      expect(mockProvider).toHaveBeenCalledTimes(1)
    })

    it('only initializes protocol once', () => {
      const transport = createTransport()
      transport.onReceive(() => void 0)
      transport.send({ type: 'TEST' })
      transport.send({ type: 'TEST2' })
      expect(mockProvider).toHaveBeenCalledTimes(1)
    })
  })

  describe('send', () => {
    it('routes action through network protocol send', () => {
      const transport = createTransport()
      const action = { type: 'TEST_ACTION', data: 123 }

      transport.send(action)

      expect(mockNetworkProtocol.send).toHaveBeenCalledWith('nexus', 'channel', action)
    })

    it('uses custom origin when provided', () => {
      const transport = createTransport({ origin: 'https://example.com' })
      const encryptedPacket = new Uint8Array([1, 2, 3])

      transport.send({ type: 'TEST' })

      if (capturedSendPacket) {
        capturedSendPacket(encryptedPacket)
      }

      expect(mockTarget.postMessage).toHaveBeenCalledWith(encryptedPacket, 'https://example.com', expect.any(Array))
    })

    it('does not send when stopped', () => {
      const transport = createTransport()
      transport.onReceive(() => void 0)
      transport.stop()
      transport.send({ type: 'TEST_ACTION' })

      expect(mockNetworkProtocol.send).not.toHaveBeenCalled()
    })

    it('resumes sending after resume', () => {
      const transport = createTransport()
      transport.onReceive(() => void 0)
      transport.stop()
      transport.resume()
      transport.send({ type: 'TEST_ACTION' })

      expect(mockNetworkProtocol.send).toHaveBeenCalled()
    })

    it('sends encrypted packet via postMessage with transfer', () => {
      const transport = createTransport()
      const encryptedPacket = new Uint8Array([1, 2, 3, 4, 5])

      transport.send({ type: 'TEST' })

      if (capturedSendPacket) {
        capturedSendPacket(encryptedPacket)
      }

      expect(mockTarget.postMessage).toHaveBeenCalledWith(encryptedPacket, '*', [encryptedPacket.buffer])
    })

    it('does not send packet when stopped', () => {
      const transport = createTransport()
      transport.send({ type: 'TEST' })
      transport.stop()

      if (capturedSendPacket) {
        capturedSendPacket(new Uint8Array([1, 2, 3]))
      }

      expect(mockTarget.postMessage).not.toHaveBeenCalled()
    })
  })

  describe('onReceive', () => {
    it('registers handler for decrypted packets', () => {
      const transport = createTransport()
      const handler = jest.fn()
      const decryptedData = { type: 'DECRYPTED_ACTION', payload: 'test' }

      transport.onReceive(handler)

      if (capturedReceivePacket) {
        capturedReceivePacket({ origin: 'nexus', target: 'channel', data: decryptedData })
      }

      expect(handler).toHaveBeenCalledWith(decryptedData)
    })

    it('replaces previous handler when called multiple times', () => {
      const transport = createTransport()
      const handler1 = jest.fn()
      const handler2 = jest.fn()

      transport.onReceive(handler1)
      transport.onReceive(handler2)

      if (capturedReceivePacket) {
        capturedReceivePacket({ origin: 'nexus', target: 'channel', data: { type: 'TEST' } })
      }

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
    })

    it('does not deliver when stopped', () => {
      const transport = createTransport()
      const handler = jest.fn()

      transport.onReceive(handler)
      transport.stop()

      if (capturedReceivePacket) {
        capturedReceivePacket({ origin: 'nexus', target: 'channel', data: { type: 'TEST' } })
      }

      expect(handler).not.toHaveBeenCalled()
    })

    it('resumes delivery after resume', () => {
      const transport = createTransport()
      const handler = jest.fn()

      transport.onReceive(handler)
      transport.stop()
      transport.resume()

      if (capturedReceivePacket) {
        capturedReceivePacket({ origin: 'nexus', target: 'channel', data: { type: 'DELIVERED' } })
      }

      expect(handler).toHaveBeenCalledWith({ type: 'DELIVERED' })
    })
  })

  describe('handleReceive', () => {
    it('routes encrypted packet through network protocol receive', () => {
      const transport = createTransport()
      const encryptedPacket = new Uint8Array([1, 2, 3, 4, 5])

      transport.onReceive(() => void 0)
      transport.handleReceive(encryptedPacket)

      expect(mockNetworkProtocol.receive).toHaveBeenCalledWith(encryptedPacket)
    })

    it('does not process when stopped', () => {
      const transport = createTransport()

      transport.onReceive(() => void 0)
      transport.stop()
      transport.handleReceive(new Uint8Array([1, 2, 3]))

      expect(mockNetworkProtocol.receive).not.toHaveBeenCalled()
    })

    it('does not process when protocol not initialized', () => {
      const transport = createTransport()
      transport.handleReceive(new Uint8Array([1, 2, 3]))

      expect(mockNetworkProtocol.receive).not.toHaveBeenCalled()
    })
  })

  describe('isReady', () => {
    it('reports not ready before initialization', () => {
      const transport = createTransport()
      expect(transport.isReady()).toBe(false)
    })

    it('reports ready after initialization via send', () => {
      const transport = createTransport()
      transport.send({ type: 'TEST' })
      expect(transport.isReady()).toBe(true)
    })

    it('reports ready after initialization via onReceive', () => {
      const transport = createTransport()
      transport.onReceive(() => void 0)
      expect(transport.isReady()).toBe(true)
    })
  })

  describe('getProtocol', () => {
    it('returns v1 for v1 transport', () => {
      const transport = createTransport({ protocol: 'v1' })
      expect(transport.getProtocol()).toBe('v1')
    })

    it('returns v2 for v2 transport', () => {
      const transport = createTransport({ protocol: 'v2' })
      expect(transport.getProtocol()).toBe('v2')
    })
  })

  describe('error handling', () => {
    it('notifies error handler on send failure', () => {
      const onError = jest.fn()
      const transport = createSecureTransport({
        protocol: 'v2',
        provider: mockProvider,
        target: mockTarget as unknown as Window,
        onError,
      })

      mockNetworkProtocol.send.mockImplementation(() => {
        throw new Error('Encryption failed')
      })

      transport.send({ type: 'TEST' })

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Encryption failed'),
        })
      )
    })

    it('notifies error handler on receive failure', () => {
      const onError = jest.fn()
      const transport = createSecureTransport({
        protocol: 'v2',
        provider: mockProvider,
        target: mockTarget as unknown as Window,
        onError,
      }) as SecurityTransport & { handleReceive: (packet: Uint8Array) => void }

      mockNetworkProtocol.receive.mockImplementation(() => {
        throw new Error('Decryption failed')
      })

      transport.onReceive(() => void 0)
      transport.handleReceive(new Uint8Array([1, 2, 3]))

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Decryption failed'),
        })
      )
    })

    it('does not throw when no error handler is provided', () => {
      const transport = createTransport()

      mockNetworkProtocol.send.mockImplementation(() => {
        throw new Error('Encryption failed')
      })

      expect(() => {
        transport.send({ type: 'TEST' })
      }).not.toThrow()
    })
  })

  describe('stop and resume', () => {
    it('can be called multiple times without error', () => {
      const transport = createTransport()

      expect(() => {
        transport.stop()
        transport.stop()
        transport.resume()
        transport.resume()
      }).not.toThrow()
    })
  })
})
