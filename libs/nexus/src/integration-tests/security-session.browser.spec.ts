import type { IChannelSettings } from '../types/channel'
import type { SecurityErrorEventData } from '../types/events'
import type { SecurityProtocolProviders } from '../types/security'
import type { MockWindow, Party, RecordedEvent } from './test-utils'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { ACTION_TYPES } from '../types/action'
import {
  collectEvents,
  createContractPair,
  createForgedFrame,
  createForgedHello,
  createMockWindow,
  createParty,
  createV3Provider,
  createV4Provider,
  destroyParties,
  framesTo,
  linkMockWindows,
  plaintextTypesTo,
  simulateMessage,
  wait,
  waitFor,
} from './test-utils'

const SHARED_KEY = 'security-session-spec-shared-key'
const OTHER_KEY = 'a-different-key-on-the-other-side'

describe('Integration: Secure Session', () => {
  const { contractA, contractB } = createContractPair(['PING'], ['PONG'])
  const v3Settings: Partial<IChannelSettings> = { security: { protocol: 'v3' } }

  let windowA: MockWindow
  let windowB: MockWindow
  let parties: Party[]

  beforeEach(() => {
    windowA = createMockWindow()
    windowB = createMockWindow()
    linkMockWindows(windowA, windowB, 'http://host-a.com', 'http://host-b.com')
    parties = []
  })

  afterEach(() => {
    destroyParties(...parties)
    jest.clearAllMocks()
  })

  interface PartyOptions {
    name?: string
    providers?: SecurityProtocolProviders
    channelSettings?: Partial<IChannelSettings>
  }

  const setupParty = (side: 'a' | 'b', options: PartyOptions = {}): Party => {
    const party = createParty({
      name: options.name ?? `broker-${side}`,
      contract: side === 'a' ? contractA : contractB,
      window: side === 'a' ? windowA : windowB,
      counterpart: side === 'a' ? windowB : windowA,
      channelName: side === 'a' ? 'to-b' : 'to-a',
      providers: options.providers,
      channelSettings: options.channelSettings,
    })
    parties.push(party)
    return party
  }

  const setupV3Pair = () => ({
    a: setupParty('a', { providers: { v3: createV3Provider() }, channelSettings: v3Settings }),
    b: setupParty('b', { providers: { v3: createV3Provider() }, channelSettings: v3Settings }),
  })

  const readyEvents = (party: Party) => collectEvents(party.channel, ['security-ready'])

  const keyPair = async (a: Party, b: Party) => {
    const readyA = readyEvents(a)
    const readyB = readyEvents(b)
    a.channel.connect()
    b.channel.connect()
    await waitFor(() => readyA.length === 1 && readyB.length === 1)
    windowA.postMessage.mockClear()
    windowB.postMessage.mockClear()
    return { readyA, readyB }
  }

  const errorCodes = (events: RecordedEvent[]) => events.map((event) => (event.data as SecurityErrorEventData).code)

  describe('sealed traffic', () => {
    it('transmits product actions as Uint8Array frames and delivers them decrypted in both directions', async () => {
      const { a, b } = setupV3Pair()
      const messagesA: unknown[] = []
      const messagesB: unknown[] = []
      // how: onMessage also echoes the channel's own outbound sends, so each collector keeps only the inbound type.
      a.channel.onMessage((message) => message.type === 'PONG' && messagesA.push(message))
      b.channel.onMessage((message) => message.type === 'PING' && messagesB.push(message))
      await keyPair(a, b)

      a.channel.send('PING', { n: 1 })
      await waitFor(() => messagesB.length === 1)
      b.channel.send('PONG', { n: 2 })
      await waitFor(() => messagesA.length === 1)

      expect({ toB: framesTo(windowB), toA: framesTo(windowA), messagesA, messagesB }).toEqual({
        toB: [expect.any(Uint8Array)],
        toA: [expect.any(Uint8Array)],
        messagesA: [expect.objectContaining({ type: 'PONG', data: { n: 2 } })],
        messagesB: [expect.objectContaining({ type: 'PING', data: { n: 1 } })],
      })
    })

    it('never lets a plaintext new-message leave once the session is secured', async () => {
      const { a, b } = setupV3Pair()
      const messagesB: unknown[] = []
      b.channel.onMessage((message) => messagesB.push(message))
      await keyPair(a, b)

      a.channel.send('PING', { n: 1 })
      b.channel.send('PONG', { n: 2 })
      await waitFor(() => messagesB.length === 2)

      expect({ toB: plaintextTypesTo(windowB), toA: plaintextTypesTo(windowA) }).toEqual({ toB: [], toA: [] })
    })

    it('does not expose the product payload on the wire', async () => {
      const { a, b } = setupV3Pair()
      const messagesB: unknown[] = []
      b.channel.onMessage((message) => messagesB.push(message))
      await keyPair(a, b)

      a.channel.send('PING', { secret: 'classified-payload' })
      await waitFor(() => messagesB.length === 1)

      const wireFrame = framesTo(windowB)[0] as Uint8Array
      expect(new TextDecoder().decode(wireFrame)).not.toContain('classified-payload')
    })

    it('delivers a send made before security-ready only after it, sealed once the session is keyed', async () => {
      const { a, b } = setupV3Pair()
      const timeline: string[] = []
      b.channel.on('security-ready', () => timeline.push('security-ready'))
      b.channel.onMessage((message) => timeline.push(`message:${message.type}`))
      a.channel.connect()
      b.channel.connect()

      a.channel.send('PING', { early: true })
      await waitFor(() => timeline.length === 2)

      expect({ timeline, plaintextProductFrames: plaintextTypesTo(windowB).filter((type) => type === ACTION_TYPES.NEW_MESSAGE) }).toEqual({
        timeline: ['security-ready', 'message:PING'],
        plaintextProductFrames: [],
      })
    })

    it('flushes sends queued before the handshake as sealed frames after open', async () => {
      const { a, b } = setupV3Pair()
      const messagesB: unknown[] = []
      b.channel.onMessage((message) => messagesB.push(message))
      a.channel.send('PING', { seq: 1 })

      a.channel.connect()
      b.channel.connect()
      await waitFor(() => messagesB.length === 1)

      expect({
        delivered: messagesB,
        plaintextProductFrames: plaintextTypesTo(windowB).filter((type) => type === ACTION_TYPES.NEW_MESSAGE),
      }).toEqual({
        delivered: [expect.objectContaining({ type: 'PING', data: { seq: 1 } })],
        plaintextProductFrames: [],
      })
    })
  })

  describe('plaintext bypass', () => {
    it('drops a plaintext new-message a stranger posts into a secured channel window with an invalid event', async () => {
      const { a, b } = setupV3Pair()
      const messagesB: unknown[] = []
      b.channel.onMessage((message) => messagesB.push(message))
      const invalidB = collectEvents(b.channel, ['invalid'])
      await keyPair(a, b)

      simulateMessage(
        windowB,
        { type: ACTION_TYPES.NEW_MESSAGE, senderId: a.broker.id, data: { type: 'PING', data: { forged: true } } },
        'http://host-a.com',
        windowA
      )

      expect({ messagesB, invalidB }).toEqual({
        messagesB: [],
        invalidB: [
          {
            event: 'invalid',
            data: expect.objectContaining({ error: `Dropped plaintext '${ACTION_TYPES.NEW_MESSAGE}' action: the channel is secured.` }),
          },
        ],
      })
    })

    it('drops a wire frame from an origin other than the pinned one with an invalid event', async () => {
      const { a, b } = setupV3Pair()
      const invalidA = collectEvents(a.channel, ['invalid'])
      const errorsA = collectEvents(a.channel, ['security-error'])
      await keyPair(a, b)

      simulateMessage(windowA, new Uint8Array([3, 0, 0, 0, 0, 0, 0, 0, 0, 1, 7, 7, 7]), 'http://evil.example', windowB)
      await waitFor(() => invalidA.length === 1)

      expect({ invalidA, errorsA }).toEqual({
        invalidA: [{ event: 'invalid', data: { error: "Dropped a wire frame from unexpected origin 'http://evil.example'." } }],
        errorsA: [],
      })
    })
  })

  describe('forged frames', () => {
    it('reports authentication-failed for a forged first sealed frame and still confirms the genuine session', async () => {
      const { a, b } = setupV3Pair()
      const readyA = readyEvents(a)
      const errorsA = collectEvents(a.channel, ['security-error'])
      const closesA = collectEvents(a.channel, ['close'])
      a.channel.connect()
      b.channel.connect()

      // how: the frame passes every check that precedes decryption, so only the session keys can reject it.
      simulateMessage(windowA, createForgedFrame(3), 'http://host-b.com', windowB)
      await waitFor(() => readyA.length === 1)

      expect({ errors: errorCodes(errorsA), readyA, closesA, active: a.channel.isActive() }).toEqual({
        errors: ['authentication-failed'],
        readyA: [{ event: 'security-ready', data: { protocol: 'v3' } }],
        closesA: [],
        active: true,
      })
    })
  })

  describe('v4 with mismatched shared keys', () => {
    const settings: Partial<IChannelSettings> = { security: { protocol: 'v4' }, connectTimeoutMs: 300 }

    const setupMismatchedPair = () => ({
      a: setupParty('a', { providers: { v4: createV4Provider(SHARED_KEY) }, channelSettings: settings }),
      b: setupParty('b', { providers: { v4: createV4Provider(OTHER_KEY) }, channelSettings: settings }),
    })

    const closed = (events: RecordedEvent[]) => events.some((event) => event.event === 'close')

    const terminalEvents = (events: RecordedEvent[]) =>
      events.filter(
        (event) =>
          event.event === 'close' ||
          (event.event === 'security-error' && (event.data as SecurityErrorEventData).code === 'security-unconfirmed')
      )

    it('never fires security-ready on either side', async () => {
      const { a, b } = setupMismatchedPair()
      const readyA = readyEvents(a)
      const readyB = readyEvents(b)
      const closesA = collectEvents(a.channel, ['close'])
      const closesB = collectEvents(b.channel, ['close'])

      a.channel.connect()
      b.channel.connect()
      await waitFor(() => closed(closesA) && closed(closesB))

      expect({ readyA, readyB }).toEqual({ readyA: [], readyB: [] })
    })

    it('ends both active sides with a security-unconfirmed error followed by a silent close', async () => {
      const { a, b } = setupMismatchedPair()
      const eventsA = collectEvents(a.channel, ['security-error', 'close'])
      const eventsB = collectEvents(b.channel, ['security-error', 'close'])

      a.channel.connect()
      b.channel.connect()
      const activeAfterHandshake = [a.channel.isActive(), b.channel.isActive()]
      await waitFor(() => closed(eventsA) && closed(eventsB))

      const unconfirmed = [
        { event: 'security-error', data: expect.objectContaining({ code: 'security-unconfirmed' }) },
        { event: 'close', data: { notify: false, reason: 'security-unconfirmed' } },
      ]
      expect({
        activeAfterHandshake,
        a: terminalEvents(eventsA),
        b: terminalEvents(eventsB),
        activeAfterClose: [a.channel.isActive(), b.channel.isActive()],
        transports: [a.channel.getSecurityTransport(), b.channel.getSecurityTransport()],
      }).toEqual({
        activeAfterHandshake: [true, true],
        a: unconfirmed,
        b: unconfirmed,
        activeAfterClose: [false, false],
        transports: [null, null],
      })
    })
  })

  describe('session lifecycle', () => {
    it('re-keys a fresh session when the counterpart reloads with a new broker id', async () => {
      const { a, b } = setupV3Pair()
      await keyPair(a, b)
      const firstTransport = b.channel.getSecurityTransport()
      const lifecycleB = collectEvents(b.channel, ['close', 'open', 'security-ready'])
      const messagesB: unknown[] = []
      b.channel.onMessage((message) => messagesB.push(message))

      // how: a reloaded page re-creates its broker in the same window, so the counterpart sees a REQUEST from a new sender id.
      const reloaded = setupParty('a', { name: 'broker-a-reloaded', providers: { v3: createV3Provider() }, channelSettings: v3Settings })
      const readyReloaded = readyEvents(reloaded)
      reloaded.channel.connect()
      await waitFor(() => readyReloaded.length === 1 && lifecycleB.some((event) => event.event === 'security-ready'))
      reloaded.channel.send('PING', { fresh: true })
      await waitFor(() => messagesB.length === 1)

      expect({
        lifecycleB,
        readyReloaded,
        freshTransport: b.channel.getSecurityTransport() !== firstTransport,
        peerId: b.channel.getPeerId(),
        messagesB,
      }).toEqual({
        lifecycleB: [
          { event: 'close', data: { notify: false, reason: 'peer-reload' } },
          { event: 'open', data: expect.objectContaining({ origin: 'http://host-a.com' }) },
          { event: 'security-ready', data: { protocol: 'v3' } },
        ],
        readyReloaded: [{ event: 'security-ready', data: { protocol: 'v3' } }],
        freshTransport: true,
        peerId: reloaded.broker.id,
        messagesB: [expect.objectContaining({ type: 'PING', data: { fresh: true } })],
      })
    })

    it('releases the transport when the channel is destroyed', async () => {
      const { a, b } = setupV3Pair()
      await keyPair(a, b)

      a.channel.destroy(false)

      expect({ transport: a.channel.getSecurityTransport(), active: a.channel.isActive() }).toEqual({ transport: null, active: false })
    })

    it('releases the transport and forgets the protocol when a scheduled responder cancels before OPEN', () => {
      const a = setupParty('a', { providers: { v3: createV3Provider() }, channelSettings: v3Settings })
      const b = setupParty('b', { providers: { v3: createV3Provider() }, channelSettings: v3Settings })
      // how: swallowing the OPEN leaves the responder waiting with its transport attached, which is the state cancel() has to clean up.
      windowB.postMessage.mockImplementation((data: unknown) => {
        if ((data as { type?: string }).type !== ACTION_TYPES.OPEN_CONNECTION) {
          windowB._dispatchMessage(new MessageEvent('message', { data, origin: 'http://host-a.com', source: windowA as unknown as Window }))
        }
      })
      b.channel.connect()
      a.channel.connect()
      const attachedWhileAwaitingOpen = b.channel.getSecurityTransport()?.getProtocol()

      b.channel.cancel(false)

      expect({
        attachedWhileAwaitingOpen,
        transport: b.channel.getSecurityTransport(),
        negotiated: b.channel.getNegotiatedProtocol(),
        awaitingOpen: b.channel.isAwaitingOpen(),
      }).toEqual({ attachedWhileAwaitingOpen: 'v3', transport: null, negotiated: null, awaitingOpen: false })
    })
  })

  describe('forged frames after the session is keyed', () => {
    it('reports unsupported-version for a frame wearing another protocol version byte', async () => {
      const { a, b } = setupV3Pair()
      const errorsA = collectEvents(a.channel, ['security-error'])
      await keyPair(a, b)

      simulateMessage(windowA, createForgedFrame(4), 'http://host-b.com', windowB)
      await waitFor(() => errorsA.length === 1)

      expect({ errors: errorCodes(errorsA), active: a.channel.isActive() }).toEqual({ errors: ['unsupported-version'], active: true })
    })

    it('reports malformed for a frame too short to carry a packet', async () => {
      const { a, b } = setupV3Pair()
      const errorsA = collectEvents(a.channel, ['security-error'])
      await keyPair(a, b)

      // magic: 11 bytes is a whole header plus one byte, short of the 27 a sealed packet needs.
      simulateMessage(windowA, createForgedFrame(3, 11), 'http://host-b.com', windowB)
      await waitFor(() => errorsA.length === 1)

      expect({ errors: errorCodes(errorsA), active: a.channel.isActive() }).toEqual({ errors: ['malformed'], active: true })
    })

    it('reports replayed for a genuine frame delivered a second time', async () => {
      const { a, b } = setupV3Pair()
      const messagesB: unknown[] = []
      b.channel.onMessage((message) => messagesB.push(message))
      const errorsB = collectEvents(b.channel, ['security-error'])
      await keyPair(a, b)
      a.channel.send('PING', { n: 1 })
      await waitFor(() => messagesB.length === 1)

      simulateMessage(windowB, framesTo(windowB)[0] as Uint8Array, 'http://host-a.com', windowA)
      await waitFor(() => errorsB.length === 1)

      expect({ errors: errorCodes(errorsB), delivered: messagesB.length }).toEqual({ errors: ['replayed'], delivered: 1 })
    })

    it('reports hello-rejected for a hello that differs from the one keying the session', async () => {
      const { a, b } = setupV3Pair()
      const errorsA = collectEvents(a.channel, ['security-error'])
      await keyPair(a, b)

      simulateMessage(windowA, createForgedHello(3), 'http://host-b.com', windowB)

      expect({ errors: errorCodes(errorsA), active: a.channel.isActive() }).toEqual({ errors: ['hello-rejected'], active: true })
    })
  })

  describe('a hello that cannot key the session', () => {
    it('cancels a responder still awaiting OPEN and denies with security-unavailable', async () => {
      const a = setupParty('a', { providers: { v3: createV3Provider() }, channelSettings: v3Settings })
      const b = setupParty('b', { providers: { v3: createV3Provider() }, channelSettings: v3Settings })
      // how: only the REQUEST reaches the responder, so it waits for OPEN with its transport started and no genuine hello in flight.
      windowB.postMessage.mockImplementation((data: unknown) => {
        if ((data as { type?: string }).type === ACTION_TYPES.REQUEST_CONNECTION) {
          windowB._dispatchMessage(new MessageEvent('message', { data, origin: 'http://host-a.com', source: windowA as unknown as Window }))
        }
      })
      const eventsB = collectEvents(b.channel, ['security-error', 'deny', 'connect-timeout'])
      // how: frames dispatch synchronously, so the initiator connects first and the responder answers from its scheduled activation.
      a.channel.connect()
      b.channel.connect()

      simulateMessage(windowB, createForgedHello(3), 'http://host-a.com', windowA)
      await waitFor(() => eventsB.some((event) => event.event === 'deny'))

      expect({
        eventsB,
        transport: b.channel.getSecurityTransport(),
        awaitingOpen: b.channel.isAwaitingOpen(),
        cancelToA: plaintextTypesTo(windowA).includes(ACTION_TYPES.CANCEL_CONNECTION),
      }).toEqual({
        eventsB: [
          { event: 'security-error', data: expect.objectContaining({ code: 'invalid-session' }) },
          {
            event: 'deny',
            data: {
              error: expect.stringContaining('Dropped outbound packet at seal'),
              reason: 'security-unavailable',
              origin: 'http://host-a.com',
            },
          },
        ],
        transport: null,
        awaitingOpen: false,
        cancelToA: true,
      })
    })
  })

  describe('wire frames outside a session', () => {
    it('drops a wire frame posted into a plaintext channel window without an event', () => {
      const a = setupParty('a')
      const b = setupParty('b')
      const messagesB: unknown[] = []
      b.channel.onMessage((message) => messagesB.push(message))
      a.channel.connect()
      b.channel.connect()
      const eventsB = collectEvents(b.channel)

      simulateMessage(windowB, createForgedFrame(3), 'http://host-a.com', windowA)

      expect({ eventsB, messagesB, active: b.channel.isActive() }).toEqual({ eventsB: [], messagesB: [], active: true })
    })

    it('ignores a wire frame from a window no channel targets', async () => {
      const { a, b } = setupV3Pair()
      await keyPair(a, b)
      const eventsB = collectEvents(b.channel)

      simulateMessage(windowB, createForgedFrame(3), 'http://stranger.example', createMockWindow())
      await wait(50)

      expect({ eventsB, active: b.channel.isActive() }).toEqual({ eventsB: [], active: true })
    })
  })

  describe('backpressure', () => {
    it('holds sealed traffic while the transport is stopped and releases it on resume', async () => {
      const { a, b } = setupV3Pair()
      const messagesB: unknown[] = []
      b.channel.onMessage((message) => messagesB.push(message))
      await keyPair(a, b)
      const transport = a.channel.getSecurityTransport()

      transport?.stop()
      a.channel.send('PING', { n: 1 })
      await wait(50)
      const framesWhileStopped = framesTo(windowB).length
      transport?.resume()
      await waitFor(() => messagesB.length === 1)

      expect({ framesWhileStopped, framesAfterResume: framesTo(windowB) }).toEqual({
        framesWhileStopped: 0,
        framesAfterResume: [expect.any(Uint8Array)],
      })
    })
  })
})
