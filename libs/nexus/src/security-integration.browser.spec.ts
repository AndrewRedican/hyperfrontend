import type { SecurityProvider, SecurityTransport, SecurityProtocolVersion } from './types/security'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { logger } from '@hyperfrontend/logging'
import { createChannel } from '@hyperfrontend/network-protocol/browser/channel'
import { createProtocol as createV1Protocol } from '@hyperfrontend/network-protocol/browser/v1'
import { createProtocol as createV2Protocol } from '@hyperfrontend/network-protocol/browser/v2'
import { uuidV4 } from '@hyperfrontend/random-generator-utils'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { negotiateProtocol, createSecurityRequest, createSecurityResponse } from './security/negotiation/negotiate'
import { createProtocolRegistry } from './security/registry/factory'
import { createSecurityTransport } from './security/transport/factory'

const PSK = 'integration-spec-shared-key'

const createV1Provider = (): SecurityProvider => ({
  createChannel,
  protocolProvider: createV1Protocol(logger, 1),
})

const createV2Provider = (): SecurityProvider => ({
  createChannel,
  protocolProvider: createV2Protocol(logger, PSK, 1),
})

async function waitFor(condition: () => boolean, attempts = 160): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (condition()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw createError('Timed out waiting for condition')
}

interface Endpoint {
  transport: SecurityTransport
  received: unknown[]
}

interface ConnectedParties {
  initiator: Endpoint
  responder: Endpoint
  wire: unknown[]
}

function connectParties(negotiated: SecurityProtocolVersion, createProvider?: () => SecurityProvider): ConnectedParties {
  const wire: unknown[] = []
  const transports: { initiator?: SecurityTransport; responder?: SecurityTransport } = {}
  const initiator: Partial<Endpoint> = { received: [] }
  const responder: Partial<Endpoint> = { received: [] }
  const responderWindow = {
    postMessage: (payload: Uint8Array) => {
      wire.push(payload)
      transports.responder?.receive(payload)
    },
  } as unknown as Window
  const initiatorWindow = {
    postMessage: (payload: Uint8Array) => {
      wire.push(payload)
      transports.initiator?.receive(payload)
    },
  } as unknown as Window
  const initiatorId = uuidV4()
  const responderId = uuidV4()
  transports.initiator = createSecurityTransport({
    protocol: negotiated,
    provider: createProvider?.(),
    label: 'initiator',
    target: responderWindow,
    getOrigin: () => 'https://responder.example.com',
    originId: initiatorId,
    targetId: responderId,
    onAction: (action) => initiator.received?.push(action),
  })
  transports.responder = createSecurityTransport({
    protocol: negotiated,
    provider: createProvider?.(),
    label: 'responder',
    target: initiatorWindow,
    getOrigin: () => 'https://initiator.example.com',
    originId: responderId,
    targetId: initiatorId,
    onAction: (action) => responder.received?.push(action),
  })
  initiator.transport = transports.initiator
  responder.transport = transports.responder
  return { initiator: initiator as Endpoint, responder: responder as Endpoint, wire }
}

describe('Integration: Security Protocol', () => {
  describe('v2 handshake with registry-sourced providers', () => {
    it('negotiates v2 when both registries hold a v2 provider', () => {
      const initiatorRegistry = createProtocolRegistry()
      const responderRegistry = createProtocolRegistry()
      initiatorRegistry.register('v2', createV2Provider())
      initiatorRegistry.register('v1', createV1Provider())
      responderRegistry.register('v2', createV2Provider())

      const request = createSecurityRequest(initiatorRegistry.getSupportedVersions())
      const result = negotiateProtocol(request, responderRegistry.getSupportedVersions())

      expect(result).toEqual({ negotiated: 'v2', isPreferred: true })
    })

    it('exchanges encrypted actions in both directions after negotiation', async () => {
      const registry = createProtocolRegistry()
      registry.register('v2', createV2Provider())
      const request = createSecurityRequest(registry.getSupportedVersions())
      const { negotiated } = negotiateProtocol(request, registry.getSupportedVersions())
      const { initiator, responder } = connectParties(negotiated, createV2Provider)

      initiator.transport.send({ type: 'GREETING', data: 'hello' })
      await waitFor(() => responder.received.length === 1)
      responder.transport.send({ type: 'REPLY', data: 'world' })
      await waitFor(() => initiator.received.length === 1)

      expect({ atInitiator: initiator.received, atResponder: responder.received }).toEqual({
        atInitiator: [{ type: 'REPLY', data: 'world' }],
        atResponder: [{ type: 'GREETING', data: 'hello' }],
      })
    })

    it('carries only Uint8Array ciphertext on the wire', async () => {
      const { initiator, responder, wire } = connectParties('v2', createV2Provider)

      initiator.transport.send({ type: 'GREETING' })
      await waitFor(() => responder.received.length === 1)
      responder.transport.send({ type: 'REPLY' })
      await waitFor(() => initiator.received.length === 1)

      expect(wire).toEqual([expect.any(Uint8Array), expect.any(Uint8Array)])
    })

    it('answers the negotiation with a v2 response', () => {
      const response = createSecurityResponse('v2')

      expect(response).toEqual({ negotiated: 'v2' })
    })
  })

  describe('v1 handshake with registry-sourced providers', () => {
    it('negotiates v1 when the responder lacks a v2 provider', () => {
      const initiatorRegistry = createProtocolRegistry()
      const responderRegistry = createProtocolRegistry()
      initiatorRegistry.register('v2', createV2Provider())
      initiatorRegistry.register('v1', createV1Provider())
      responderRegistry.register('v1', createV1Provider())

      const request = createSecurityRequest(initiatorRegistry.getSupportedVersions())
      const result = negotiateProtocol(request, responderRegistry.getSupportedVersions())

      expect(result.negotiated).toBe('v1')
    })

    it('exchanges obfuscated actions in both directions after negotiation', async () => {
      const { initiator, responder } = connectParties('v1', createV1Provider)

      initiator.transport.send({ type: 'GREETING', data: 'hello' })
      await waitFor(() => responder.received.length === 1)
      responder.transport.send({ type: 'REPLY', data: 'world' })
      await waitFor(() => initiator.received.length === 1)

      expect({ atInitiator: initiator.received, atResponder: responder.received }).toEqual({
        atInitiator: [{ type: 'REPLY', data: 'world' }],
        atResponder: [{ type: 'GREETING', data: 'hello' }],
      })
    })
  })

  describe('fallback to none', () => {
    it('negotiates none when the peers share no protocol', () => {
      const initiatorRegistry = createProtocolRegistry()
      const responderRegistry = createProtocolRegistry()
      initiatorRegistry.register('v2', createV2Provider())
      responderRegistry.register('v1', createV1Provider())

      const request = createSecurityRequest(initiatorRegistry.getSupportedVersions())
      const result = negotiateProtocol(request, responderRegistry.getSupportedVersions())

      expect(result.negotiated).toBe('none')
    })

    it('negotiates none when the request carries no security capabilities', () => {
      const responderRegistry = createProtocolRegistry()
      responderRegistry.register('v2', createV2Provider())

      const request = createSecurityRequest([])
      const result = negotiateProtocol(request, responderRegistry.getSupportedVersions())

      expect(result.negotiated).toBe('none')
    })

    it('passes actions through unchanged when negotiated down to none', () => {
      const { initiator, wire } = connectParties('none')

      initiator.transport.send({ type: 'PLAINTEXT', data: 1 })

      expect(wire).toEqual([{ type: 'PLAINTEXT', data: 1 }])
    })
  })

  describe('registry-transport wiring', () => {
    it('creates a transport from the provider stored in the registry', () => {
      const registry = createProtocolRegistry()
      registry.register('v2', createV2Provider())

      const transport = createSecurityTransport({
        protocol: 'v2',
        provider: registry.get('v2') as SecurityProvider,
        label: 'from-registry',
        target: { postMessage: jest.fn() } as unknown as Window,
        getOrigin: () => null,
        originId: uuidV4(),
        targetId: uuidV4(),
        onAction: jest.fn(),
      })

      expect(transport.getProtocol()).toBe('v2')
    })

    it('fails fast when the negotiated protocol has no registered provider', () => {
      const registry = createProtocolRegistry()

      expect(() =>
        createSecurityTransport({
          protocol: 'v2',
          provider: registry.get('v2') as SecurityProvider | undefined,
          label: 'missing-provider',
          target: { postMessage: jest.fn() } as unknown as Window,
          getOrigin: () => null,
          originId: uuidV4(),
          targetId: uuidV4(),
          onAction: jest.fn(),
        })
      ).toThrow("Security protocol 'v2' requires a protocol provider")
    })
  })
})
