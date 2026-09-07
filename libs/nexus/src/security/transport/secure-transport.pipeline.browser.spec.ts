import type { Mock } from '@hyperfrontend/testing'
import type {
  SecurityChannelOptions,
  SecurityErrorCode,
  SecurityPacketData,
  SecurityPacketDrop,
  SecurityProvider,
  SecurityTransport,
  SecurityWireChannel,
} from '../../types/security'
import type { SecureTransportConfig } from './types'
import { after as afterAll, afterEach, before as beforeAll } from 'node:test'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
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
const FRAME_VERDICTS: readonly SecurityErrorCode[] = [
  'unsupported-version',
  'replayed',
  'authentication-failed',
  'malformed',
  'counter-exhausted',
]

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

function createDrop(overrides: Partial<SecurityPacketDrop> = {}): SecurityPacketDrop {
  return { direction: 'inbound', stage: 'open', reason: 'bad tag', packet: {}, ...overrides }
}

function captureEnvelopes(channel: ScriptedChannel): SecurityPacketData[] {
  const envelopes: SecurityPacketData[] = []
  channel.send.mockImplementation((_origin: string, _target: string, data: SecurityPacketData) => {
    envelopes.push(data)
  })
  return envelopes
}

describe('createSecureTransport pipeline callbacks', () => {
  beforeAll(() => {
    jest.useFakeTimers()
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  describe('dropped packets', () => {
    for (const code of FRAME_VERDICTS) {
      it(`reports a drop the protocol judged '${code}' under that code`, () => {
        const { options, onError } = createHarness()
        const cause = { code }

        options.onDrop?.(createDrop({ cause }))

        expect(onError).toHaveBeenCalledWith({ message: 'Dropped inbound packet at open: bad tag', code, cause })
      })
    }

    it('keeps the session alive for a drop the protocol judged on the frame', () => {
      const { options, onFailed } = createHarness()

      options.onDrop?.(createDrop({ cause: { code: 'replayed' } }))

      expect(onFailed).not.toHaveBeenCalled()
    })

    it('reports a drop without a cause as transport-error', () => {
      const { options, onError } = createHarness()

      options.onDrop?.(createDrop({ direction: 'outbound', stage: 'seal', reason: 'no key' }))

      expect(onError).toHaveBeenCalledWith({ message: 'Dropped outbound packet at seal: no key', code: 'transport-error' })
    })

    it('reports a drop with an unrecognised cause as transport-error', () => {
      const { options, onError } = createHarness()
      const cause = createError('boom')

      options.onDrop?.(createDrop({ cause }))

      expect(onError).toHaveBeenCalledWith({ message: 'Dropped inbound packet at open: bad tag', code: 'transport-error', cause })
    })

    it('reports an invalid session', () => {
      const { options, onError } = createHarness()
      const cause = { code: 'invalid-session' }

      options.onDrop?.(createDrop({ cause }))

      expect(onError).toHaveBeenCalledWith({ message: 'Dropped inbound packet at open: bad tag', code: 'invalid-session', cause })
    })

    it('fails the session when its keys cannot be derived', () => {
      const { options, onFailed } = createHarness()
      const cause = { code: 'invalid-session' }

      options.onDrop?.(createDrop({ cause }))

      expect(onFailed).toHaveBeenCalledWith({ message: 'Dropped inbound packet at open: bad tag', code: 'invalid-session', cause })
    })

    it('does not fail the session again at the deadline after an invalid session', () => {
      const { transport, options, onFailed } = createHarness()

      transport.start()
      options.onDrop?.(createDrop({ cause: { code: 'invalid-session' } }))
      jest.advanceTimersByTime(CONFIRM_MS)

      expect(onFailed).toHaveBeenCalledTimes(1)
    })

    it('ignores an invalid session after dispose', () => {
      const { transport, options, onFailed } = createHarness()

      transport.dispose()
      options.onDrop?.(createDrop({ cause: { code: 'invalid-session' } }))

      expect(onFailed).not.toHaveBeenCalled()
    })
  })

  describe('send', () => {
    it('seals the action from the local endpoint to the counterpart', () => {
      const { transport, channel } = createHarness()

      transport.send({ type: 'PING' })

      expect(channel.send).toHaveBeenCalledWith(ORIGIN_ID, TARGET_ID, expect.objectContaining({ message: { type: 'PING' } }))
    })

    it('wraps the action in a schemaless envelope', () => {
      const { transport, channel } = createHarness()

      transport.send({ type: 'PING' })

      expect(channel.send).toHaveBeenCalledWith(ORIGIN_ID, TARGET_ID, {
        pid: expect.any(String),
        id: expect.any(String),
        sequence: 1,
        message: { type: 'PING' },
        schema: {},
        schemaHash: EMPTY_SCHEMA_HASH,
      })
    })

    it('increments the sequence on every send', () => {
      const { transport, channel } = createHarness()

      transport.send({ type: 'PING' })
      transport.send({ type: 'PONG' })

      expect(channel.send).toHaveBeenNthCalledWith(2, ORIGIN_ID, TARGET_ID, expect.objectContaining({ sequence: 2 }))
    })

    it('stamps every envelope with the same process id', () => {
      const channel = createScriptedChannel()
      const envelopes = captureEnvelopes(channel)
      const { transport } = createHarness({}, channel)

      transport.send({ type: 'PING' })
      transport.send({ type: 'PONG' })

      expect(envelopes.map((envelope) => envelope.pid)).toEqual([expect.any(String), envelopes[0]?.pid])
    })

    it('gives every envelope its own id', () => {
      const channel = createScriptedChannel()
      const envelopes = captureEnvelopes(channel)
      const { transport } = createHarness({}, channel)

      transport.send({ type: 'PING' })
      transport.send({ type: 'PONG' })

      expect(envelopes[1]?.id).not.toBe(envelopes[0]?.id)
    })

    it('reports a pipeline throw as transport-error', () => {
      const cause = createError('pipeline closed')
      const channel = createScriptedChannel()
      channel.send.mockImplementation(() => {
        throw cause
      })
      const { transport, onError } = createHarness({}, channel)

      transport.send({ type: 'PING' })

      expect(onError).toHaveBeenCalledWith({ message: 'pipeline closed', code: 'transport-error', cause })
    })

    it('survives a pipeline throw without an error handler', () => {
      const channel = createScriptedChannel()
      channel.send.mockImplementation(() => {
        throw createError('pipeline closed')
      })
      const { transport } = createHarness({ onError: undefined }, channel)

      expect(() => transport.send({ type: 'PING' })).not.toThrow()
    })

    it('ignores actions after dispose', () => {
      const { transport, channel } = createHarness()

      transport.dispose()
      transport.send({ type: 'PING' })

      expect(channel.send).not.toHaveBeenCalled()
    })
  })

  describe('sealed frames', () => {
    it('posts each sealed frame with its buffer in the transfer list', () => {
      const { options, postMessage } = createHarness()

      options.send(SEALED_FRAME)

      expect(postMessage).toHaveBeenCalledWith(SEALED_FRAME, '*', [SEALED_FRAME.buffer])
    })

    it('posts sealed frames to the pinned origin', () => {
      const { options, postMessage } = createHarness({ getOrigin: () => PINNED_ORIGIN })

      options.send(SEALED_FRAME)

      expect(postMessage).toHaveBeenCalledWith(SEALED_FRAME, PINNED_ORIGIN, [SEALED_FRAME.buffer])
    })

    it('lets a frame sealed after dispose leave', () => {
      const { transport, options, postMessage } = createHarness({ getOrigin: () => PINNED_ORIGIN })

      transport.dispose()
      options.send(SEALED_FRAME)

      expect(postMessage).toHaveBeenCalledWith(SEALED_FRAME, PINNED_ORIGIN, [SEALED_FRAME.buffer])
    })
  })

  describe('backpressure', () => {
    it('stop pauses the pipeline', () => {
      const { transport, channel } = createHarness()

      transport.stop()

      expect(channel.stop).toHaveBeenCalledTimes(1)
    })

    it('resume restarts the pipeline', () => {
      const { transport, channel } = createHarness()

      transport.resume()

      expect(channel.resume).toHaveBeenCalledTimes(1)
    })
  })

  describe('dispose', () => {
    it('leaves the pipeline running so sealing frames can still leave', () => {
      const { transport, channel } = createHarness()

      transport.dispose()

      expect(channel.stop).not.toHaveBeenCalled()
    })

    it('ignores drop reports after dispose', () => {
      const { transport, options, onError } = createHarness()

      transport.dispose()
      options.onDrop?.(createDrop({ cause: { code: 'replayed' } }))

      expect(onError).not.toHaveBeenCalled()
    })

    it('clears the hello retries', () => {
      const { transport, channel } = createHarness()

      transport.start()
      transport.dispose()
      jest.advanceTimersByTime(RETRY_MS * 3)

      expect(channel.hello).toHaveBeenCalledTimes(1)
    })

    it('clears the confirmation deadline', () => {
      const { transport, onFailed } = createHarness()

      transport.start()
      transport.dispose()
      jest.advanceTimersByTime(CONFIRM_MS)

      expect(onFailed).not.toHaveBeenCalled()
    })
  })
})
