import type { SecurityProtocolVersion, SecurityProvider, SecurityTransport } from './types/security'
import { uuidV4 } from '@hyperfrontend/random-generator-utils'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createForgedFrame, createForgedHello, createV3Provider, createV4Provider, wait, waitFor } from './integration-tests/test-utils'
import { createSecurityRequest, createSecurityResponse, negotiateProtocol } from './security/negotiation/negotiate'
import { createProtocolRegistry } from './security/registry/factory'
import { createSecurityTransport } from './security/transport/factory'

const SHARED_KEY = 'security-integration-spec-shared-key'
const OTHER_KEY = 'another-key-the-counterpart-holds'
const INITIATOR_ORIGIN = 'https://initiator.example.com'
const RESPONDER_ORIGIN = 'https://responder.example.com'

/** Which end of the pair an endpoint or a frame belongs to */
type Side = 'initiator' | 'responder'

/** One postMessage call recorded on a fake window */
interface WireCall {
  /** The endpoint the frame was posted to */
  readonly to: Side
  /** The posted payload */
  readonly payload: unknown
  /** The target origin the post named */
  readonly origin: string
  /** Whether the post carried a transfer list */
  readonly transferred: boolean
}

/** One end of a transport pair and what its callbacks recorded */
interface Endpoint {
  /** The transport under test */
  readonly transport: SecurityTransport
  /** Actions the transport delivered, in order */
  readonly received: unknown[]
  /** Lifecycle notifications in order: 'confirmed', 'error:<code>', 'failed:<code>' */
  readonly events: string[]
}

/** How a transport pair is built */
interface PairConfig {
  /** The protocol both transports run */
  readonly protocol: SecurityProtocolVersion
  /** Builds the initiator's provider; absent for plaintext */
  readonly initiatorProvider?: () => SecurityProvider
  /** Builds the responder's provider; absent for plaintext */
  readonly responderProvider?: () => SecurityProvider
  /** How long each endpoint gives the counterpart to confirm the session */
  readonly confirmTimeoutMs?: number
}

/** A wired transport pair */
interface Pair {
  /** The endpoint that plays the initiator */
  readonly initiator: Endpoint
  /** The endpoint that plays the responder */
  readonly responder: Endpoint
  /** Every post either endpoint made, in order */
  readonly wire: WireCall[]
}

// magic: A hello is 99 bytes and carries the hello type byte second; every other frame is a sealed packet.
const isHello = (payload: unknown): boolean => payload instanceof Uint8Array && payload.length === 99 && payload[1] === 1

const v3Pair = (): PairConfig => ({ protocol: 'v3', initiatorProvider: createV3Provider, responderProvider: createV3Provider })

const v4Pair = (initiatorKey: string, responderKey: string, confirmTimeoutMs?: number): PairConfig => ({
  protocol: 'v4',
  initiatorProvider: () => createV4Provider(initiatorKey),
  responderProvider: () => createV4Provider(responderKey),
  ...(confirmTimeoutMs !== undefined && { confirmTimeoutMs }),
})

function connectPair(config: PairConfig): Pair {
  const wire: WireCall[] = []
  const endpoints: Partial<Record<Side, Endpoint>> = {}
  const ids: Record<Side, string> = { initiator: uuidV4(), responder: uuidV4() }
  const origins: Record<Side, string> = { initiator: INITIATOR_ORIGIN, responder: RESPONDER_ORIGIN }
  const providers: Record<Side, (() => SecurityProvider) | undefined> = {
    initiator: config.initiatorProvider,
    responder: config.responderProvider,
  }

  // how: a post lands on the counterpart's transport synchronously, so the wire is exactly what the transports exchanged.
  const windowOf = (side: Side): Window =>
    ({
      postMessage: (payload: unknown, origin: string, transfer?: unknown[]) => {
        wire.push({ to: side, payload, origin, transferred: transfer !== undefined })
        endpoints[side]?.transport.receive(payload as Uint8Array)
      },
    }) as unknown as Window

  const createEndpoint = (side: Side, peer: Side): Endpoint => {
    const received: unknown[] = []
    const events: string[] = []
    const transport = createSecurityTransport({
      protocol: config.protocol,
      provider: providers[side]?.(),
      label: side,
      target: windowOf(peer),
      getOrigin: () => origins[peer],
      originId: ids[side],
      targetId: ids[peer],
      role: side,
      confirmTimeoutMs: config.confirmTimeoutMs ?? 10_000,
      onAction: (action) => received.push(action),
      onError: (error) => events.push(`error:${error.code}`),
      onConfirmed: () => events.push('confirmed'),
      onFailed: (error) => events.push(`failed:${error.code}`),
    })
    return { transport, received, events }
  }

  const initiator = createEndpoint('initiator', 'responder')
  const responder = createEndpoint('responder', 'initiator')
  endpoints.initiator = initiator
  endpoints.responder = responder
  return { initiator, responder, wire }
}

const startPair = (pair: Pair): void => {
  pair.initiator.transport.start()
  pair.responder.transport.start()
}

const confirmed = (endpoint: Endpoint): boolean => endpoint.events.includes('confirmed')

const keyPair = async (pair: Pair): Promise<void> => {
  startPair(pair)
  await waitFor(() => confirmed(pair.initiator) && confirmed(pair.responder))
}

describe('Integration: Security Protocol', () => {
  describe('registry-sourced negotiation', () => {
    it('selects v4 when both registries hold v4 and v3', () => {
      const initiatorRegistry = createProtocolRegistry()
      const responderRegistry = createProtocolRegistry()
      initiatorRegistry.register('v3', createV3Provider())
      initiatorRegistry.register('v4', createV4Provider(SHARED_KEY))
      responderRegistry.register('v4', createV4Provider(SHARED_KEY))
      responderRegistry.register('v3', createV3Provider())

      const request = createSecurityRequest(initiatorRegistry.getSupportedVersions())

      expect(negotiateProtocol(request, responderRegistry.getSupportedVersions())).toEqual({ negotiated: 'v4', isPreferred: true })
    })

    it('selects v3 when the responder lacks a v4 provider', () => {
      const initiatorRegistry = createProtocolRegistry()
      const responderRegistry = createProtocolRegistry()
      initiatorRegistry.register('v4', createV4Provider(SHARED_KEY))
      initiatorRegistry.register('v3', createV3Provider())
      responderRegistry.register('v3', createV3Provider())

      const request = createSecurityRequest(initiatorRegistry.getSupportedVersions())

      expect(negotiateProtocol(request, responderRegistry.getSupportedVersions())).toEqual({ negotiated: 'v3', isPreferred: false })
    })

    it('selects none when the peers share no protocol', () => {
      const initiatorRegistry = createProtocolRegistry()
      const responderRegistry = createProtocolRegistry()
      initiatorRegistry.register('v4', createV4Provider(SHARED_KEY))
      responderRegistry.register('v3', createV3Provider())

      const request = createSecurityRequest(initiatorRegistry.getSupportedVersions())

      expect(negotiateProtocol(request, responderRegistry.getSupportedVersions()).negotiated).toBe('none')
    })

    it('selects none when the request carries no capabilities', () => {
      const responderRegistry = createProtocolRegistry()
      responderRegistry.register('v4', createV4Provider(SHARED_KEY))

      expect(negotiateProtocol(createSecurityRequest([]), responderRegistry.getSupportedVersions()).negotiated).toBe('none')
    })

    it('advertises v4 before v3 with none last whatever the registration order', () => {
      const registry = createProtocolRegistry()
      registry.register('v3', createV3Provider())
      registry.register('v4', createV4Provider(SHARED_KEY))

      expect(registry.getSupportedVersions()).toEqual(['v4', 'v3', 'none'])
    })

    it('answers the negotiation with the selected protocol alone', () => {
      expect(createSecurityResponse('v4')).toEqual({ negotiated: 'v4' })
    })
  })

  describe('v3 session', () => {
    it('confirms both endpoints once their hellos cross', async () => {
      const pair = connectPair(v3Pair())

      await keyPair(pair)

      expect({ initiator: pair.initiator.events, responder: pair.responder.events }).toEqual({
        initiator: ['confirmed'],
        responder: ['confirmed'],
      })
    })

    it('swallows the confirmation action instead of delivering it', async () => {
      const pair = connectPair(v3Pair())

      await keyPair(pair)

      expect({ initiator: pair.initiator.received, responder: pair.responder.received }).toEqual({ initiator: [], responder: [] })
    })

    it('exchanges actions in both directions once keyed', async () => {
      const pair = connectPair(v3Pair())
      await keyPair(pair)

      pair.initiator.transport.send({ type: 'GREETING', data: 'hello' })
      await waitFor(() => pair.responder.received.length === 1)
      pair.responder.transport.send({ type: 'REPLY', data: 'world' })
      await waitFor(() => pair.initiator.received.length === 1)

      expect({ atInitiator: pair.initiator.received, atResponder: pair.responder.received }).toEqual({
        atInitiator: [{ type: 'REPLY', data: 'world' }],
        atResponder: [{ type: 'GREETING', data: 'hello' }],
      })
    })

    it('confirms the responder on the initiator first sealed frame even when it carries a product action', async () => {
      const pair = connectPair(v3Pair())

      // why: an action sent before the session is keyed waits in the seal stage and leaves as the first sealed frame, ahead of the confirmation.
      pair.initiator.transport.send({ type: 'EARLY' })
      startPair(pair)
      await waitFor(() => pair.responder.received.length === 1)

      expect({ events: pair.responder.events, received: pair.responder.received }).toEqual({
        events: ['confirmed'],
        received: [{ type: 'EARLY' }],
      })
    })

    it('carries only Uint8Array frames addressed to the pinned origins', async () => {
      const pair = connectPair(v3Pair())
      await keyPair(pair)

      pair.initiator.transport.send({ type: 'GREETING' })
      await waitFor(() => pair.responder.received.length === 1)

      expect(
        pair.wire.every(
          (call) => call.payload instanceof Uint8Array && call.origin === (call.to === 'initiator' ? INITIATOR_ORIGIN : RESPONDER_ORIGIN)
        )
      ).toBe(true)
    })

    it('posts hellos by copy and every sealed frame with its buffer transferred', async () => {
      const pair = connectPair(v3Pair())
      await keyPair(pair)

      pair.initiator.transport.send({ type: 'GREETING' })
      await waitFor(() => pair.responder.received.length === 1)

      expect(pair.wire.map((call) => ({ hello: isHello(call.payload), transferred: call.transferred }))).toEqual(
        pair.wire.map((call) => ({ hello: isHello(call.payload), transferred: !isHello(call.payload) }))
      )
    })
  })

  describe('v4 session', () => {
    it('confirms both endpoints under the same shared key', async () => {
      const pair = connectPair(v4Pair(SHARED_KEY, SHARED_KEY))

      await keyPair(pair)

      expect({ initiator: pair.initiator.events, responder: pair.responder.events }).toEqual({
        initiator: ['confirmed'],
        responder: ['confirmed'],
      })
    })

    it('fails both endpoints with security-unconfirmed when the shared keys differ', async () => {
      // magic: 300ms keeps the confirmation deadline short while leaving the key stretching room to finish.
      const pair = connectPair(v4Pair(SHARED_KEY, OTHER_KEY, 300))
      const failed = (endpoint: Endpoint) => endpoint.events.includes('failed:security-unconfirmed')
      // why: each side's sealed confirmation fails to open under the other's keys, and when that verdict lands relative to the deadline is timing.
      const terminal = (endpoint: Endpoint) => endpoint.events.filter((event) => event !== 'error:authentication-failed')

      startPair(pair)
      await waitFor(() => failed(pair.initiator) && failed(pair.responder))

      expect({ initiator: terminal(pair.initiator), responder: terminal(pair.responder) }).toEqual({
        initiator: ['error:security-unconfirmed', 'failed:security-unconfirmed'],
        responder: ['error:security-unconfirmed', 'failed:security-unconfirmed'],
      })
    })
  })

  describe('forged frames', () => {
    it('reports authentication-failed for a forged sealed frame and still confirms the genuine session', async () => {
      const pair = connectPair(v3Pair())

      pair.initiator.transport.receive(createForgedFrame(3))
      await keyPair(pair)

      expect(pair.initiator.events).toEqual(['error:authentication-failed', 'confirmed'])
    })

    it('reports hello-rejected for a hello that differs from the one keying the session', async () => {
      const pair = connectPair(v3Pair())
      await keyPair(pair)

      pair.initiator.transport.receive(createForgedHello(3))

      expect(pair.initiator.events).toEqual(['confirmed', 'error:hello-rejected'])
    })

    it('ignores the counterpart hello delivered a second time', async () => {
      const pair = connectPair(v3Pair())
      await keyPair(pair)
      const hello = pair.wire.find((call) => call.to === 'initiator' && isHello(call.payload))?.payload as Uint8Array

      pair.initiator.transport.receive(hello)

      expect(pair.initiator.events).toEqual(['confirmed'])
    })
  })

  describe('plaintext', () => {
    it('passes actions through unchanged when negotiated down to none', () => {
      const pair = connectPair({ protocol: 'none' })

      pair.initiator.transport.send({ type: 'PLAINTEXT', data: 1 })

      expect({ wire: pair.wire, received: pair.responder.received }).toEqual({
        wire: [{ to: 'responder', payload: { type: 'PLAINTEXT', data: 1 }, origin: RESPONDER_ORIGIN, transferred: false }],
        received: [{ type: 'PLAINTEXT', data: 1 }],
      })
    })
  })

  describe('disposal', () => {
    it('posts nothing for a send made after dispose', async () => {
      const pair = connectPair(v3Pair())
      await keyPair(pair)
      const posted = pair.wire.length

      pair.initiator.transport.dispose()
      pair.initiator.transport.send({ type: 'LATE' })
      await wait(50)

      expect(pair.wire.length).toBe(posted)
    })
  })

  describe('registry-transport wiring', () => {
    it('creates a transport from the provider stored in the registry', () => {
      const registry = createProtocolRegistry()
      registry.register('v4', createV4Provider(SHARED_KEY))

      const transport = createSecurityTransport({
        protocol: 'v4',
        provider: registry.get('v4'),
        label: 'from-registry',
        target: { postMessage: () => undefined } as unknown as Window,
        getOrigin: () => null,
        originId: uuidV4(),
        targetId: uuidV4(),
        role: 'initiator',
        onAction: () => undefined,
      })

      expect(transport.getProtocol()).toBe('v4')
    })

    it('fails fast when the negotiated protocol has no registered provider', () => {
      const registry = createProtocolRegistry()

      expect(() =>
        createSecurityTransport({
          protocol: 'v4',
          provider: registry.get('v4'),
          label: 'missing-provider',
          target: { postMessage: () => undefined } as unknown as Window,
          getOrigin: () => null,
          originId: uuidV4(),
          targetId: uuidV4(),
          role: 'initiator',
          onAction: () => undefined,
        })
      ).toThrow("Security protocol 'v4' requires a protocol provider")
    })
  })
})
