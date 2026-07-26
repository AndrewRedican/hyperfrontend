import type { SecurityProvider, SecurityTransport, SecurityTransportError } from '../../types/security'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { logger } from '@hyperfrontend/logging'
import { createChannel } from '@hyperfrontend/network-protocol/browser/channel'
import { createProtocol as createV1Protocol } from '@hyperfrontend/network-protocol/browser/v1'
import { createProtocol as createV2Protocol } from '@hyperfrontend/network-protocol/browser/v2'
import { uuidV4 } from '@hyperfrontend/random-generator-utils'
import { createSecureTransport } from './secure-transport'

const PSK = 'secure-transport-spec-shared-key'

const createV2Provider = (): SecurityProvider => ({
  createChannel,
  protocolProvider: createV2Protocol(logger, PSK, 1),
})

const createV1Provider = (): SecurityProvider => ({
  createChannel,
  protocolProvider: createV1Protocol(logger, 1),
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

interface Party {
  transport: SecurityTransport
  received: unknown[]
  errors: SecurityTransportError[]
  wireOutbound: Uint8Array[]
}

interface TransportPair {
  a: Party
  b: Party
}

function createTransportPair(protocol: 'v1' | 'v2', createProvider: () => SecurityProvider): TransportPair {
  const transports: { a?: SecurityTransport; b?: SecurityTransport } = {}
  const a: Partial<Party> = { received: [], errors: [], wireOutbound: [] }
  const b: Partial<Party> = { received: [], errors: [], wireOutbound: [] }
  const windowOfB = <Window>(<unknown>{
    postMessage: (payload: Uint8Array) => {
      a.wireOutbound?.push(payload)
      transports.b?.receive(payload)
    },
  })
  const windowOfA = <Window>(<unknown>{
    postMessage: (payload: Uint8Array) => {
      b.wireOutbound?.push(payload)
      transports.a?.receive(payload)
    },
  })
  const idA = uuidV4()
  const idB = uuidV4()
  transports.a = createSecureTransport({
    protocol,
    provider: createProvider(),
    label: 'party-a',
    target: windowOfB,
    getOrigin: () => 'https://b.example.com',
    originId: idA,
    targetId: idB,
    onAction: (action) => a.received?.push(action),
    onError: (error) => a.errors?.push(error),
  })
  transports.b = createSecureTransport({
    protocol,
    provider: createProvider(),
    label: 'party-b',
    target: windowOfA,
    getOrigin: () => 'https://a.example.com',
    originId: idB,
    targetId: idA,
    onAction: (action) => b.received?.push(action),
    onError: (error) => b.errors?.push(error),
  })
  a.transport = transports.a
  b.transport = transports.b
  return { a: <Party>a, b: <Party>b }
}

describe('SecureTransport (two-party)', () => {
  describe('v2 (pre-shared key)', () => {
    it('delivers the identical action from initiator to responder', async () => {
      const { a, b } = createTransportPair('v2', createV2Provider)
      const action = { type: 'PING', data: { value: 42 } }

      a.transport.send(action)
      await waitFor(() => b.received.length === 1)

      expect(b.received).toEqual([action])
    })

    it('delivers the identical action from responder to initiator', async () => {
      const { a, b } = createTransportPair('v2', createV2Provider)
      const action = { type: 'PONG', data: { value: 7 } }

      b.transport.send(action)
      await waitFor(() => a.received.length === 1)

      expect(a.received).toEqual([action])
    })

    it('delivers an interleaved bidirectional conversation', async () => {
      const { a, b } = createTransportPair('v2', createV2Provider)

      a.transport.send({ type: 'PING', data: 1 })
      await waitFor(() => b.received.length === 1)
      b.transport.send({ type: 'PONG', data: 2 })
      await waitFor(() => a.received.length === 1)
      a.transport.send({ type: 'PING', data: 3 })
      await waitFor(() => b.received.length === 2)

      expect({ atA: a.received, atB: b.received }).toEqual({
        atA: [{ type: 'PONG', data: 2 }],
        atB: [
          { type: 'PING', data: 1 },
          { type: 'PING', data: 3 },
        ],
      })
    })

    it('transmits only Uint8Array payloads on the wire', async () => {
      const { a, b } = createTransportPair('v2', createV2Provider)

      a.transport.send({ type: 'SECRET_ACTION', data: 'classified' })
      await waitFor(() => b.received.length === 1)

      expect(a.wireOutbound).toEqual([expect.any(Uint8Array)])
    })

    it('does not expose the action plaintext on the wire', async () => {
      const { a, b } = createTransportPair('v2', createV2Provider)

      a.transport.send({ type: 'SECRET_ACTION', data: 'classified' })
      await waitFor(() => b.received.length === 1)

      expect(new TextDecoder().decode(a.wireOutbound[0])).not.toContain('SECRET_ACTION')
    })

    it('reports ready from construction', () => {
      const { a } = createTransportPair('v2', createV2Provider)

      expect(a.transport.isReady()).toBe(true)
    })

    it('reports the v2 protocol', () => {
      const { a } = createTransportPair('v2', createV2Provider)

      expect(a.transport.getProtocol()).toBe('v2')
    })
  })

  describe('v1 (obfuscation on the base key)', () => {
    it('delivers the identical action from initiator to responder', async () => {
      const { a, b } = createTransportPair('v1', createV1Provider)
      const action = { type: 'PING', data: { value: 42 } }

      a.transport.send(action)
      await waitFor(() => b.received.length === 1)

      expect(b.received).toEqual([action])
    })

    it('delivers the identical action from responder to initiator', async () => {
      const { a, b } = createTransportPair('v1', createV1Provider)
      const action = { type: 'PONG', data: { value: 7 } }

      b.transport.send(action)
      await waitFor(() => a.received.length === 1)

      expect(a.received).toEqual([action])
    })

    it('delivers an interleaved bidirectional conversation', async () => {
      const { a, b } = createTransportPair('v1', createV1Provider)

      a.transport.send({ type: 'PING', data: 1 })
      await waitFor(() => b.received.length === 1)
      b.transport.send({ type: 'PONG', data: 2 })
      await waitFor(() => a.received.length === 1)
      a.transport.send({ type: 'PING', data: 3 })
      await waitFor(() => b.received.length === 2)

      expect({ atA: a.received, atB: b.received }).toEqual({
        atA: [{ type: 'PONG', data: 2 }],
        atB: [
          { type: 'PING', data: 1 },
          { type: 'PING', data: 3 },
        ],
      })
    })

    it('transmits only Uint8Array payloads on the wire', async () => {
      const { a, b } = createTransportPair('v1', createV1Provider)

      a.transport.send({ type: 'SECRET_ACTION', data: 'classified' })
      await waitFor(() => b.received.length === 1)

      expect(a.wireOutbound).toEqual([expect.any(Uint8Array)])
    })

    it('does not expose the action plaintext on the wire', async () => {
      const { a, b } = createTransportPair('v1', createV1Provider)

      a.transport.send({ type: 'SECRET_ACTION', data: 'classified' })
      await waitFor(() => b.received.length === 1)

      expect(new TextDecoder().decode(a.wireOutbound[0])).not.toContain('SECRET_ACTION')
    })

    it('reports ready from construction', () => {
      const { a } = createTransportPair('v1', createV1Provider)

      expect(a.transport.isReady()).toBe(true)
    })

    it('delivers crossing first sends made before any inbound packet', async () => {
      const { a, b } = createTransportPair('v1', createV1Provider)

      a.transport.send({ type: 'PING', data: 1 })
      b.transport.send({ type: 'PONG', data: 2 })
      await waitFor(() => a.received.length === 1 && b.received.length === 1)

      expect({ atA: a.received, atB: b.received }).toEqual({
        atA: [{ type: 'PONG', data: 2 }],
        atB: [{ type: 'PING', data: 1 }],
      })
    })

    it('reports the v1 protocol', () => {
      const { a } = createTransportPair('v1', createV1Provider)

      expect(a.transport.getProtocol()).toBe('v1')
    })
  })

  describe('backpressure', () => {
    it('holds actions while stopped', async () => {
      const { a } = createTransportPair('v2', createV2Provider)

      a.transport.stop()
      a.transport.send({ type: 'HELD' })
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(a.wireOutbound).toEqual([])
    })

    it('flushes held actions on resume', async () => {
      const { a, b } = createTransportPair('v2', createV2Provider)

      a.transport.stop()
      a.transport.send({ type: 'HELD' })
      a.transport.resume()
      await waitFor(() => b.received.length === 1)

      expect(b.received).toEqual([{ type: 'HELD' }])
    })
  })

  describe('error handling', () => {
    it('reports unencryptable payloads to the error handler', () => {
      const { a } = createTransportPair('v2', createV2Provider)

      a.transport.send(() => void 0)

      expect(a.errors).toEqual([expect.objectContaining({ message: expect.stringContaining('valid data') })])
    })

    it('does not throw when no error handler is registered', () => {
      const transport = createSecureTransport({
        protocol: 'v2',
        provider: createV2Provider(),
        label: 'no-error-handler',
        target: <Window>(<unknown>{ postMessage: jest.fn() }),
        getOrigin: () => null,
        originId: uuidV4(),
        targetId: uuidV4(),
        onAction: jest.fn(),
      })

      expect(() => transport.send(() => void 0)).not.toThrow()
    })
  })

  describe('origin pinning', () => {
    const createCapturingTransport = (getOrigin: () => string | null): { transport: SecurityTransport; postMessage: jest.Mock } => {
      const postMessage = jest.fn()
      const transport = createSecureTransport({
        protocol: 'v2',
        provider: createV2Provider(),
        label: 'origin-capture',
        target: <Window>(<unknown>{ postMessage }),
        getOrigin,
        originId: uuidV4(),
        targetId: uuidV4(),
        onAction: jest.fn(),
      })
      return { transport, postMessage }
    }

    it('posts with a wildcard target before the origin is pinned', async () => {
      const { transport, postMessage } = createCapturingTransport(() => null)

      transport.send({ type: 'PING' })
      await waitFor(() => postMessage.mock.calls.length === 1)

      expect(postMessage).toHaveBeenCalledWith(expect.any(Uint8Array), '*', expect.any(Array))
    })

    it('posts with a wildcard target for opaque origins', async () => {
      const { transport, postMessage } = createCapturingTransport(() => 'null')

      transport.send({ type: 'PING' })
      await waitFor(() => postMessage.mock.calls.length === 1)

      expect(postMessage).toHaveBeenCalledWith(expect.any(Uint8Array), '*', expect.any(Array))
    })

    it('posts to the pinned origin once learned', async () => {
      const { transport, postMessage } = createCapturingTransport(() => 'https://feature.example.com')

      transport.send({ type: 'PING' })
      await waitFor(() => postMessage.mock.calls.length === 1)

      expect(postMessage).toHaveBeenCalledWith(expect.any(Uint8Array), 'https://feature.example.com', expect.any(Array))
    })
  })
})
