/**
 * Integration Tests: Security Protocol Integration
 *
 * Tests the complete security layer integration including protocol
 * negotiation, transport encryption/decryption, and handshake flow.
 */

import { createProtocolRegistry } from '../security/registry'
import { negotiateProtocol, createSecurityRequest, createSecurityResponse } from '../security/negotiation'
import { createSecurityTransport } from '../security/transport'
import { createNoneTransport } from '../security/transport/none-transport'
import type { SecurityProtocolVersion, SecurityNegotiationRequest } from '../types/security'

describe('Integration: Security Protocol', () => {
  describe('Protocol Negotiation Scenarios', () => {
    describe('negotiate v1 between compatible parties', () => {
      it('selects v1 when both parties support it', () => {
        const initiatorRequest = createSecurityRequest(['v1', 'none'])
        const responderSupported: SecurityProtocolVersion[] = ['v1', 'none']

        const result = negotiateProtocol(initiatorRequest, responderSupported)

        expect(result.negotiated).toBe('v1')
      })

      it('creates proper response for v1 negotiation', () => {
        const response = createSecurityResponse('v1')

        expect(response.negotiated).toBe('v1')
        expect(response.publicParams).toBeUndefined()
      })

      it('includes public params in v1 response when needed', () => {
        const publicParams = { keyHint: 'initial-challenge' }
        const response = createSecurityResponse('v1', publicParams)

        expect(response.negotiated).toBe('v1')
        expect(response.publicParams).toEqual(publicParams)
      })
    })

    describe('negotiate v2 with shared key', () => {
      it('selects v2 when both parties support it', () => {
        const initiatorRequest = createSecurityRequest(['v2', 'v1', 'none'])
        const responderSupported: SecurityProtocolVersion[] = ['v2', 'v1', 'none']

        const result = negotiateProtocol(initiatorRequest, responderSupported)

        expect(result.negotiated).toBe('v2')
        expect(result.isPreferred).toBe(true)
      })

      it('creates proper response for v2 negotiation', () => {
        const response = createSecurityResponse('v2', { sharedKeyHint: 'psk-hash' })

        expect(response.negotiated).toBe('v2')
        expect(response.publicParams).toEqual({ sharedKeyHint: 'psk-hash' })
      })
    })

    describe('fallback to none when initiator has no security', () => {
      it('falls back to none when initiator only supports none', () => {
        const initiatorRequest = createSecurityRequest(['none'])
        const responderSupported: SecurityProtocolVersion[] = ['v2', 'v1', 'none']

        const result = negotiateProtocol(initiatorRequest, responderSupported)

        expect(result.negotiated).toBe('none')
      })

      it('falls back to none when initiator supported list is empty', () => {
        const initiatorRequest = createSecurityRequest([])
        const responderSupported: SecurityProtocolVersion[] = ['v2', 'v1', 'none']

        const result = negotiateProtocol(initiatorRequest, responderSupported)

        expect(result.negotiated).toBe('none')
      })
    })

    describe('fallback to none when responder has no security', () => {
      it('falls back to none when responder only supports none', () => {
        const initiatorRequest = createSecurityRequest(['v2', 'v1', 'none'])
        const responderSupported: SecurityProtocolVersion[] = ['none']

        const result = negotiateProtocol(initiatorRequest, responderSupported)

        expect(result.negotiated).toBe('none')
      })

      it('falls back to none when responder supported list is empty', () => {
        const initiatorRequest = createSecurityRequest(['v2', 'v1', 'none'])
        const responderSupported: SecurityProtocolVersion[] = []

        const result = negotiateProtocol(initiatorRequest, responderSupported)

        expect(result.negotiated).toBe('none')
      })
    })

    describe('backward compatibility with no security field', () => {
      it('treats missing security as none protocol', () => {
        const mockRequest: SecurityNegotiationRequest = {
          supported: ['none'],
          preferred: 'none',
        }
        const responderSupported: SecurityProtocolVersion[] = ['v2', 'v1', 'none']

        const result = negotiateProtocol(mockRequest, responderSupported)

        expect(result.negotiated).toBe('none')
      })

      it('none transport works without security configuration', () => {
        const mockTarget = { postMessage: jest.fn() }
        const transport = createNoneTransport({ target: mockTarget as unknown as Window })

        expect(transport.isReady()).toBe(true)
        expect(transport.getProtocol()).toBe('none')
      })
    })
  })

  describe('Registry Integration', () => {
    it('registry provides supported versions for negotiation', () => {
      const registry = createProtocolRegistry()

      const mockV1Provider = { id: 'v1-mock' }
      const mockV2Provider = { id: 'v2-mock' }

      registry.register('v1', mockV1Provider)
      registry.register('v2', mockV2Provider)

      const supported = registry.getSupportedVersions()
      const request = createSecurityRequest(supported)

      expect(request.supported).toContain('v2')
      expect(request.supported).toContain('v1')
      expect(request.supported).toContain('none')
      expect(request.preferred).toBe('v2')
    })

    it('registry correctly reports unavailable protocols', () => {
      const registry = createProtocolRegistry()

      registry.register('v1', { id: 'v1-mock' })

      expect(registry.has('v1')).toBe(true)
      expect(registry.has('v2')).toBe(false)
      expect(registry.has('none')).toBe(true)
    })

    it('negotiation respects registry capabilities', () => {
      const initiatorRegistry = createProtocolRegistry()
      const responderRegistry = createProtocolRegistry()

      initiatorRegistry.register('v2', { id: 'initiator-v2' })
      initiatorRegistry.register('v1', { id: 'initiator-v1' })
      responderRegistry.register('v1', { id: 'responder-v1' })

      const initiatorSupported = initiatorRegistry.getSupportedVersions()
      const responderSupported = responderRegistry.getSupportedVersions()

      const request = createSecurityRequest(initiatorSupported)
      const result = negotiateProtocol(request, responderSupported)

      expect(result.negotiated).toBe('v1')
    })
  })

  describe('Transport Integration', () => {
    describe('none transport message flow', () => {
      it('passes messages through unchanged', () => {
        const mockTarget = { postMessage: jest.fn() }
        const transport = createSecurityTransport({
          protocol: 'none',
          target: mockTarget as unknown as Window,
        })

        const testAction = { type: 'TEST_MESSAGE', payload: { data: 123 } }
        transport.send(testAction)

        expect(mockTarget.postMessage).toHaveBeenCalledWith(testAction, '*')
      })

      it('forwards received messages to handler', async () => {
        const mockTarget = { postMessage: jest.fn() }
        const transport = createNoneTransport({ target: mockTarget as unknown as Window }) as ReturnType<typeof createNoneTransport> & {
          handleReceive: (action: unknown) => void
        }

        const receivedMessages: unknown[] = []
        transport.onReceive((action) => {
          receivedMessages.push(action)
        })

        const incomingAction = { type: 'INCOMING', data: 'test' }
        transport.handleReceive(incomingAction)

        expect(receivedMessages).toHaveLength(1)
        expect(receivedMessages[0]).toEqual(incomingAction)
      })
    })

    describe('secure transport integration', () => {
      let mockProvider: jest.Mock
      let mockNetworkProtocol: { send: jest.Mock; receive: jest.Mock }
      let capturedSendPacket: ((packet: Uint8Array) => void) | null
      let capturedReceivePacket: ((packet: { origin: string; target: string; data: unknown }) => void) | null

      beforeEach(() => {
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

      it('routes messages through encryption pipeline', () => {
        const mockTarget = { postMessage: jest.fn() }
        const transport = createSecurityTransport({
          protocol: 'v2',
          provider: mockProvider,
          target: mockTarget as unknown as Window,
        })

        const testAction = { type: 'SECURE_MESSAGE', secret: 'data' }
        transport.send(testAction)

        expect(mockNetworkProtocol.send).toHaveBeenCalledWith('nexus', 'channel', testAction)
      })

      it('routes encrypted packets through postMessage', () => {
        const mockTarget = { postMessage: jest.fn() }
        createSecurityTransport({
          protocol: 'v2',
          provider: mockProvider,
          target: mockTarget as unknown as Window,
        }).send({ type: 'TEST' })

        const encryptedPacket = new Uint8Array([1, 2, 3, 4, 5])
        if (capturedSendPacket) {
          capturedSendPacket(encryptedPacket)
        }

        expect(mockTarget.postMessage).toHaveBeenCalledWith(encryptedPacket, '*', [encryptedPacket.buffer])
      })

      it('receives and decrypts incoming packets', () => {
        const mockTarget = { postMessage: jest.fn() }
        const transport = createSecurityTransport({
          protocol: 'v2',
          provider: mockProvider,
          target: mockTarget as unknown as Window,
        }) as ReturnType<typeof createSecurityTransport> & { handleReceive: (packet: Uint8Array) => void }

        const receivedMessages: unknown[] = []
        transport.onReceive((action) => {
          receivedMessages.push(action)
        })

        const decryptedAction = { type: 'DECRYPTED', payload: 'secret-data' }
        if (capturedReceivePacket) {
          capturedReceivePacket({ origin: 'nexus', target: 'channel', data: decryptedAction })
        }

        expect(receivedMessages).toContain(decryptedAction)
      })
    })
  })

  describe('Error Handling Integration', () => {
    it('handles decryption failure gracefully', () => {
      const errorMessages: string[] = []
      const mockProvider = jest.fn(() => ({
        send: jest.fn(),
        receive: jest.fn(() => {
          throw new Error('Invalid key')
        }),
      }))

      const mockTarget = { postMessage: jest.fn() }
      const transport = createSecurityTransport({
        protocol: 'v2',
        provider: mockProvider,
        target: mockTarget as unknown as Window,
        onError: (err) => {
          errorMessages.push(err.message)
        },
      }) as ReturnType<typeof createSecurityTransport> & { handleReceive: (packet: Uint8Array) => void }

      transport.onReceive(() => void 0)
      transport.handleReceive(new Uint8Array([1, 2, 3]))

      expect(errorMessages).toContain('Invalid key')
    })

    it('handles encryption failure gracefully', () => {
      const errorMessages: string[] = []
      const mockProvider = jest.fn(() => ({
        send: jest.fn(() => {
          throw new Error('Encryption failed')
        }),
        receive: jest.fn(),
      }))

      const mockTarget = { postMessage: jest.fn() }
      const transport = createSecurityTransport({
        protocol: 'v2',
        provider: mockProvider,
        target: mockTarget as unknown as Window,
        onError: (err) => {
          errorMessages.push(err.message)
        },
      })

      transport.send({ type: 'TEST' })

      expect(errorMessages).toContain('Encryption failed')
    })

    it('continues operating after error', () => {
      let callCount = 0
      const mockProvider = jest.fn(() => ({
        send: jest.fn(() => {
          callCount++
          if (callCount === 1) {
            throw new Error('Temporary failure')
          }
        }),
        receive: jest.fn(),
      }))

      const mockTarget = { postMessage: jest.fn() }
      const transport = createSecurityTransport({
        protocol: 'v2',
        provider: mockProvider,
        target: mockTarget as unknown as Window,
        onError: () => void 0,
      })

      transport.send({ type: 'FIRST' })
      transport.send({ type: 'SECOND' })

      expect(callCount).toBe(2)
    })
  })

  describe('Clock Skew Handling', () => {
    it('tolerates time differences in deobfuscation', () => {
      const deobfuscationAttempts: number[] = []
      const mockProvider = jest.fn(() => ({
        send: jest.fn(),
        receive: jest.fn(() => {
          deobfuscationAttempts.push(Date.now())
          if (deobfuscationAttempts.length < 3) {
            throw new Error('Time window miss')
          }
        }),
      }))

      const mockTarget = { postMessage: jest.fn() }
      const transport = createSecurityTransport({
        protocol: 'v2',
        provider: mockProvider,
        target: mockTarget as unknown as Window,
        onError: () => void 0,
      }) as ReturnType<typeof createSecurityTransport> & { handleReceive: (packet: Uint8Array) => void }

      transport.onReceive(() => void 0)

      for (let i = 0; i < 3; i++) {
        transport.handleReceive(new Uint8Array([1, 2, 3]))
      }

      expect(deobfuscationAttempts).toHaveLength(3)
    })
  })

  describe('Key Rotation Scenarios', () => {
    it('transport accepts refreshRate configuration', () => {
      const mockProvider = jest.fn(() => ({
        send: jest.fn(),
        receive: jest.fn(),
      }))

      const mockTarget = { postMessage: jest.fn() }
      const transport = createSecurityTransport({
        protocol: 'v2',
        provider: mockProvider,
        target: mockTarget as unknown as Window,
        refreshRate: 60,
      })

      expect(transport).toBeDefined()
      expect(transport.getProtocol()).toBe('v2')
    })
  })

  describe('Full Handshake Flow Simulation', () => {
    it('completes security negotiation in handshake sequence', () => {
      const initiatorRegistry = createProtocolRegistry()
      const responderRegistry = createProtocolRegistry()

      initiatorRegistry.register('v2', { id: 'init-v2' })
      initiatorRegistry.register('v1', { id: 'init-v1' })
      responderRegistry.register('v2', { id: 'resp-v2' })
      responderRegistry.register('v1', { id: 'resp-v1' })

      const initiatorSupported = initiatorRegistry.getSupportedVersions()
      const request = createSecurityRequest(initiatorSupported, 'v2')

      expect(request.supported).toContain('v2')
      expect(request.preferred).toBe('v2')

      const responderSupported = responderRegistry.getSupportedVersions()
      const negotiationResult = negotiateProtocol(request, responderSupported)

      expect(negotiationResult.negotiated).toBe('v2')

      const response = createSecurityResponse(negotiationResult.negotiated, {
        keyHint: 'negotiation-complete',
      })

      expect(response.negotiated).toBe('v2')
      expect(response.publicParams).toEqual({ keyHint: 'negotiation-complete' })
    })

    it('falls back gracefully when protocols do not match', () => {
      const initiatorRegistry = createProtocolRegistry()
      const responderRegistry = createProtocolRegistry()

      initiatorRegistry.register('v2', { id: 'init-v2' })
      responderRegistry.register('v1', { id: 'resp-v1' })

      const initiatorSupported = initiatorRegistry.getSupportedVersions()
      const responderSupported = responderRegistry.getSupportedVersions()

      const request = createSecurityRequest(initiatorSupported)
      const result = negotiateProtocol(request, responderSupported)

      expect(result.negotiated).toBe('none')
    })
  })
})
