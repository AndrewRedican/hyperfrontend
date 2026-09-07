import type { Mock } from '@hyperfrontend/testing'
import type { SecurityChannelOptions, SecurityPacket, SecurityProvider, SecurityTransport, SecurityWireChannel } from '../../types/security'
import type { SecureTransportConfig } from './types'
import { after as afterAll, afterEach, before as beforeAll } from 'node:test'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { ACTION_TYPES } from '../../constants/action-types'
import { createSecureTransport } from './secure-transport'

// magic: First byte the scripted protocol stamps on its hello frame.
const HELLO_MARKER = 0x48
const HELLO_FRAME = new Uint8Array([HELLO_MARKER, 1, 2, 3])
const SEALED_FRAME = new Uint8Array([0x53, 4, 5, 6])
const ORIGIN_ID = 'origin-endpoint'
const TARGET_ID = 'target-endpoint'
const PINNED_ORIGIN = 'https://feature.example.com'
const RETRY_MS = 100
// magic: Not a multiple of the retry interval, so the deadline never fires in the same tick as a retry.
const CONFIRM_MS = 250
// magic: SHA-256 hash of the serialized empty schema ('{}').
const EMPTY_SCHEMA_HASH = '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a'

interface ScriptedChannel {
  hello: Mock
  isHello: Mock
  acceptHello: Mock
  send: Mock
  receive: Mock
  stop: Mock
  resume: Mock
}

interface Harness {
  transport: SecurityTransport
  channel: ScriptedChannel
  options: SecurityChannelOptions
  createChannel: Mock
  provider: SecurityProvider
  postMessage: Mock
  onAction: Mock
  onError: Mock
  onConfirmed: Mock
  onFailed: Mock
}

interface Deferred {
  promise: Promise<Uint8Array>
  resolve: (frame: Uint8Array) => void
}

function createScriptedChannel(): ScriptedChannel {
  return {
    hello: jest.fn().mockResolvedValue(HELLO_FRAME),
    isHello: jest.fn((frame: Uint8Array) => frame[0] === HELLO_MARKER),
    acceptHello: jest.fn().mockReturnValue('accepted'),
    send: jest.fn(),
    receive: jest.fn(),
    stop: jest.fn(),
    resume: jest.fn(),
  }
}

function createDeferred(): Deferred {
  const deferred: Partial<Deferred> = {}
  deferred.promise = new Promise<Uint8Array>((resolve) => {
    deferred.resolve = resolve
  })
  return deferred as Deferred
}

function createHarness(overrides: Partial<SecureTransportConfig> = {}, channel: ScriptedChannel = createScriptedChannel()): Harness {
  const captured: { options?: SecurityChannelOptions } = {}
  const createChannel = jest.fn((label: string, options: SecurityChannelOptions): SecurityWireChannel => {
    captured.options = options
    return { label, ...channel }
  })
  const provider: SecurityProvider = { createChannel, protocolProvider: jest.fn() }
  const postMessage = jest.fn()
  const onAction = jest.fn()
  const onError = jest.fn()
  const onConfirmed = jest.fn()
  const onFailed = jest.fn()
  const transport = createSecureTransport({
    protocol: 'v4',
    provider,
    label: 'spec-channel',
    target: { postMessage } as unknown as Window,
    getOrigin: () => null,
    originId: ORIGIN_ID,
    targetId: TARGET_ID,
    role: 'initiator',
    helloRetryMs: RETRY_MS,
    confirmTimeoutMs: CONFIRM_MS,
    onAction,
    onError,
    onConfirmed,
    onFailed,
    ...overrides,
  })
  if (!captured.options) {
    throw createError('The provider did not build a wire channel')
  }
  return { transport, channel, options: captured.options, createChannel, provider, postMessage, onAction, onError, onConfirmed, onFailed }
}

function createPacket(message: unknown): SecurityPacket {
  return {
    origin: TARGET_ID,
    target: ORIGIN_ID,
    data: { pid: 'peer-process', id: 'packet-1', sequence: 1, message, schema: {}, schemaHash: EMPTY_SCHEMA_HASH },
  }
}

async function flush(): Promise<void> {
  // why: A resolved hello reaches postMessage through a promise reaction; a few microtask turns let every queued reaction run.
  for (let turn = 0; turn < 4; turn += 1) {
    await Promise.resolve()
  }
}

describe('createSecureTransport', () => {
  beforeAll(() => {
    jest.useFakeTimers()
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  describe('construction', () => {
    it('builds the wire channel under the configured label', () => {
      const { createChannel } = createHarness()

      expect(createChannel).toHaveBeenCalledWith('spec-channel', expect.any(Object))
    })

    it('builds the wire channel from the session and the pipeline callbacks', () => {
      const { options, provider } = createHarness({ role: 'responder' })

      expect(options).toEqual({
        send: expect.any(Function),
        receive: expect.any(Function),
        protocolProvider: provider.protocolProvider,
        session: { protocol: 'v4', role: 'responder', localId: ORIGIN_ID, peerId: TARGET_ID },
        onDrop: expect.any(Function),
      })
    })

    it('reports the configured protocol', () => {
      const { transport } = createHarness({ protocol: 'v3' })

      expect(transport.getProtocol()).toBe('v3')
    })
  })

  describe('start', () => {
    it('posts the hello to the target without a transfer list', async () => {
      const { transport, postMessage } = createHarness()

      transport.start()
      await flush()

      expect(postMessage.mock.calls).toEqual([[HELLO_FRAME, '*']])
    })

    it('posts the hello to the pinned origin', async () => {
      const { transport, postMessage } = createHarness({ getOrigin: () => PINNED_ORIGIN })

      transport.start()
      await flush()

      expect(postMessage).toHaveBeenCalledWith(HELLO_FRAME, PINNED_ORIGIN)
    })

    it('posts the hello with a wildcard target for opaque origins', async () => {
      const { transport, postMessage } = createHarness({ getOrigin: () => 'null' })

      transport.start()
      await flush()

      expect(postMessage).toHaveBeenCalledWith(HELLO_FRAME, '*')
    })

    it('re-posts the hello at every retry interval', async () => {
      const { transport, postMessage } = createHarness()

      transport.start()
      jest.advanceTimersByTime(RETRY_MS * 2)
      await flush()

      expect(postMessage).toHaveBeenCalledTimes(3)
    })

    it('ignores a second start', () => {
      const { transport, channel } = createHarness()

      transport.start()
      transport.start()

      expect(channel.hello).toHaveBeenCalledTimes(1)
    })

    it('ignores start after dispose', () => {
      const { transport, channel } = createHarness()

      transport.dispose()
      transport.start()

      expect(channel.hello).not.toHaveBeenCalled()
    })

    it('stops re-posting the hello once the counterpart confirms', async () => {
      const { transport, options, postMessage } = createHarness()

      transport.start()
      await flush()
      options.receive(createPacket({ type: 'PING' }))
      jest.advanceTimersByTime(RETRY_MS * 3)
      await flush()

      expect(postMessage).toHaveBeenCalledTimes(1)
    })

    it('discards a hello that resolves after the counterpart confirmed', async () => {
      const deferred = createDeferred()
      const channel = createScriptedChannel()
      channel.hello.mockReturnValue(deferred.promise)
      const { transport, options, postMessage } = createHarness({}, channel)

      transport.start()
      options.receive(createPacket({ type: 'PING' }))
      deferred.resolve(HELLO_FRAME)
      await flush()

      expect(postMessage).not.toHaveBeenCalled()
    })

    it('discards a hello that resolves after dispose', async () => {
      const deferred = createDeferred()
      const channel = createScriptedChannel()
      channel.hello.mockReturnValue(deferred.promise)
      const { transport, postMessage } = createHarness({}, channel)

      transport.start()
      transport.dispose()
      deferred.resolve(HELLO_FRAME)
      await flush()

      expect(postMessage).not.toHaveBeenCalled()
    })

    it('reports security-unconfirmed when the deadline passes', () => {
      const { transport, onError } = createHarness()

      transport.start()
      jest.advanceTimersByTime(CONFIRM_MS)

      expect(onError).toHaveBeenCalledWith({
        message: "The counterpart did not confirm the 'v4' session within 250ms.",
        code: 'security-unconfirmed',
      })
    })

    it('fails the session when the deadline passes', () => {
      const { transport, onFailed } = createHarness()

      transport.start()
      jest.advanceTimersByTime(CONFIRM_MS)

      expect(onFailed).toHaveBeenCalledWith({
        message: "The counterpart did not confirm the 'v4' session within 250ms.",
        code: 'security-unconfirmed',
      })
    })

    it('reports the deadline error before failing the session', () => {
      const order: string[] = []
      const { transport } = createHarness({ onError: () => order.push('error'), onFailed: () => order.push('failed') })

      transport.start()
      jest.advanceTimersByTime(CONFIRM_MS)

      expect(order).toEqual(['error', 'failed'])
    })

    it('stops re-posting the hello once the deadline passes', () => {
      const { transport, channel } = createHarness()

      transport.start()
      jest.advanceTimersByTime(CONFIRM_MS + RETRY_MS * 3)

      expect(channel.hello).toHaveBeenCalledTimes(3)
    })

    it('survives the deadline without failure handlers', () => {
      const { transport } = createHarness({ onError: undefined, onFailed: undefined })

      transport.start()

      expect(() => jest.advanceTimersByTime(CONFIRM_MS)).not.toThrow()
    })

    it('fails with transport-error when the hello cannot be produced', async () => {
      const cause = createError('no key material')
      const channel = createScriptedChannel()
      channel.hello.mockRejectedValue(cause)
      const { transport, onFailed } = createHarness({}, channel)

      transport.start()
      await flush()

      expect(onFailed).toHaveBeenCalledWith({
        message: "Cannot produce the 'v4' session hello: no key material",
        code: 'transport-error',
        cause,
      })
    })

    it('stops retrying the hello once it cannot be produced', async () => {
      const channel = createScriptedChannel()
      channel.hello.mockRejectedValue(createError('no key material'))
      const { transport } = createHarness({}, channel)

      transport.start()
      await flush()
      jest.advanceTimersByTime(RETRY_MS * 3)

      expect(channel.hello).toHaveBeenCalledTimes(1)
    })
  })

  describe('receive', () => {
    it('feeds a sealed frame to the opening pipeline', () => {
      const { transport, channel } = createHarness()

      transport.receive(SEALED_FRAME)

      expect(channel.receive).toHaveBeenCalledWith(SEALED_FRAME)
    })

    it('keeps a hello out of the opening pipeline', () => {
      const { transport, channel } = createHarness()

      transport.receive(HELLO_FRAME)

      expect(channel.receive).not.toHaveBeenCalled()
    })

    it("feeds the counterpart's hello to the session", () => {
      const { transport, channel } = createHarness()

      transport.receive(HELLO_FRAME)

      expect(channel.acceptHello).toHaveBeenCalledWith(HELLO_FRAME)
    })

    it('answers an accepted hello with a sealed confirmation', () => {
      const { transport, channel } = createHarness()

      transport.receive(HELLO_FRAME)

      expect(channel.send).toHaveBeenCalledWith(
        ORIGIN_ID,
        TARGET_ID,
        expect.objectContaining({ message: { type: ACTION_TYPES.SECURITY_CONFIRMED, senderId: ORIGIN_ID } })
      )
    })

    it('sends nothing for a duplicate hello', () => {
      const channel = createScriptedChannel()
      channel.acceptHello.mockReturnValue('duplicate')
      const { transport } = createHarness({}, channel)

      transport.receive(HELLO_FRAME)

      expect(channel.send).not.toHaveBeenCalled()
    })

    it('reports nothing for a duplicate hello', () => {
      const channel = createScriptedChannel()
      channel.acceptHello.mockReturnValue('duplicate')
      const { transport, onError } = createHarness({}, channel)

      transport.receive(HELLO_FRAME)

      expect(onError).not.toHaveBeenCalled()
    })

    it('reports hello-rejected for a hello that differs from the keying one', () => {
      const channel = createScriptedChannel()
      channel.acceptHello.mockReturnValue('rejected')
      const { transport, onError } = createHarness({}, channel)

      transport.receive(HELLO_FRAME)

      expect(onError).toHaveBeenCalledWith({
        message: "Rejected a hello that differs from the one keying the 'v4' session.",
        code: 'hello-rejected',
      })
    })

    it('sends nothing for a rejected hello', () => {
      const channel = createScriptedChannel()
      channel.acceptHello.mockReturnValue('rejected')
      const { transport } = createHarness({}, channel)

      transport.receive(HELLO_FRAME)

      expect(channel.send).not.toHaveBeenCalled()
    })

    it('ignores frames after dispose', () => {
      const { transport, channel } = createHarness()

      transport.dispose()
      transport.receive(SEALED_FRAME)

      expect(channel.receive).not.toHaveBeenCalled()
    })
  })

  describe('opened packets', () => {
    it('delivers the opened action', () => {
      const { options, onAction } = createHarness()

      options.receive(createPacket({ type: 'PING', data: 1 }))

      expect(onAction).toHaveBeenCalledWith({ type: 'PING', data: 1 })
    })

    it('confirms the session on the first opened packet', () => {
      const { options, onConfirmed } = createHarness()

      options.receive(createPacket({ type: 'PING' }))

      expect(onConfirmed).toHaveBeenCalledTimes(1)
    })

    it('confirms the session once', () => {
      const { options, onConfirmed } = createHarness()

      options.receive(createPacket({ type: 'PING' }))
      options.receive(createPacket({ type: 'PONG' }))

      expect(onConfirmed).toHaveBeenCalledTimes(1)
    })

    it('swallows the security confirmation action', () => {
      const { options, onAction } = createHarness()

      options.receive(createPacket({ type: ACTION_TYPES.SECURITY_CONFIRMED, senderId: TARGET_ID }))

      expect(onAction).not.toHaveBeenCalled()
    })

    it('confirms the session on a swallowed confirmation', () => {
      const { options, onConfirmed } = createHarness()

      options.receive(createPacket({ type: ACTION_TYPES.SECURITY_CONFIRMED, senderId: TARGET_ID }))

      expect(onConfirmed).toHaveBeenCalledTimes(1)
    })

    it('delivers a null message', () => {
      const { options, onAction } = createHarness()

      options.receive(createPacket(null))

      expect(onAction).toHaveBeenCalledWith(null)
    })

    it('delivers without a confirmation handler', () => {
      const { options, onAction } = createHarness({ onConfirmed: undefined })

      options.receive(createPacket({ type: 'PING' }))

      expect(onAction).toHaveBeenCalledWith({ type: 'PING' })
    })

    it('clears the confirmation deadline once confirmed', () => {
      const { transport, options, onFailed } = createHarness()

      transport.start()
      options.receive(createPacket({ type: 'PING' }))
      jest.advanceTimersByTime(CONFIRM_MS * 2)

      expect(onFailed).not.toHaveBeenCalled()
    })

    it('ignores opened packets after dispose', () => {
      const { transport, options, onAction } = createHarness()

      transport.dispose()
      options.receive(createPacket({ type: 'PING' }))

      expect(onAction).not.toHaveBeenCalled()
    })
  })
})
