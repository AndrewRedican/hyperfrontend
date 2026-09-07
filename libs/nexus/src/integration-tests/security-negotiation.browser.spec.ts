import type { IAction } from '../types/action'
import type { IChannelSettings } from '../types/channel'
import type { SecurityProtocolProviders } from '../types/security'
import type { MockWindow, Party } from './test-utils'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { ACTION_TYPES } from '../types/action'
import {
  collectEvents,
  createContractPair,
  createMockWindow,
  createParty,
  createV3Provider,
  createV4Provider,
  destroyParties,
  linkMockWindows,
  plaintextFramesTo,
  plaintextTypesTo,
  simulateMessage,
  waitFor,
} from './test-utils'

const SHARED_KEY = 'security-negotiation-spec-shared-key'

describe('Integration: Security Negotiation', () => {
  const { contractA, contractB } = createContractPair(['PING'], ['PONG'])
  const v3Settings: Partial<IChannelSettings> = { security: { protocol: 'v3' } }
  const v4Settings: Partial<IChannelSettings> = { security: { protocol: 'v4' } }

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
    providers?: SecurityProtocolProviders
    channelSettings?: Partial<IChannelSettings>
  }

  const setupParty = (side: 'a' | 'b', options: PartyOptions = {}): Party => {
    const party = createParty({
      name: `broker-${side}`,
      contract: side === 'a' ? contractA : contractB,
      window: side === 'a' ? windowA : windowB,
      counterpart: side === 'a' ? windowB : windowA,
      channelName: side === 'a' ? 'to-b' : 'to-a',
      ...options,
    })
    parties.push(party)
    return party
  }

  const readyEvents = (party: Party) => collectEvents(party.channel, ['security-ready'])

  const transportProtocols = (a: Party, b: Party) => [
    a.channel.getSecurityTransport()?.getProtocol() ?? null,
    b.channel.getSecurityTransport()?.getProtocol() ?? null,
  ]

  const readyOn = (protocol: string) => [{ event: 'security-ready', data: { protocol } }]

  describe('v3 pair', () => {
    const setupV3Pair = () => ({
      a: setupParty('a', { providers: { v3: createV3Provider() }, channelSettings: v3Settings }),
      b: setupParty('b', { providers: { v3: createV3Provider() }, channelSettings: v3Settings }),
    })

    it('keys both sides and fires security-ready on both', async () => {
      const { a, b } = setupV3Pair()
      const readyA = readyEvents(a)
      const readyB = readyEvents(b)

      a.channel.connect()
      b.channel.connect()
      await waitFor(() => readyA.length === 1 && readyB.length === 1)

      expect({ readyA, readyB }).toEqual({ readyA: readyOn('v3'), readyB: readyOn('v3') })
    })

    it('attaches a v3 transport on both ends as soon as the handshake completes', () => {
      const { a, b } = setupV3Pair()

      a.channel.connect()
      b.channel.connect()

      expect({ active: [a.channel.isActive(), b.channel.isActive()], protocols: transportProtocols(a, b) }).toEqual({
        active: [true, true],
        protocols: ['v3', 'v3'],
      })
    })

    it('keeps the handshake frames plaintext on the wire', async () => {
      const { a, b } = setupV3Pair()
      const readyA = readyEvents(a)
      const readyB = readyEvents(b)

      a.channel.connect()
      b.channel.connect()
      await waitFor(() => readyA.length === 1 && readyB.length === 1)

      expect({ toB: plaintextTypesTo(windowB), toA: plaintextTypesTo(windowA) }).toEqual({
        toB: [ACTION_TYPES.REQUEST_CONNECTION, ACTION_TYPES.OPEN_CONNECTION],
        toA: [ACTION_TYPES.ACCEPT_CONNECTION],
      })
    })
  })

  describe('v4 pair', () => {
    it('keys both sides with the same shared key and fires security-ready on both', async () => {
      const a = setupParty('a', { providers: { v4: createV4Provider(SHARED_KEY) }, channelSettings: v4Settings })
      const b = setupParty('b', { providers: { v4: createV4Provider(SHARED_KEY) }, channelSettings: v4Settings })
      const readyA = readyEvents(a)
      const readyB = readyEvents(b)

      a.channel.connect()
      b.channel.connect()
      await waitFor(() => readyA.length === 1 && readyB.length === 1)

      expect({ readyA, readyB, protocols: transportProtocols(a, b) }).toEqual({
        readyA: readyOn('v4'),
        readyB: readyOn('v4'),
        protocols: ['v4', 'v4'],
      })
    })

    it('prefers v4 when the initiator leaves the protocol to the brokers and both register v4 and v3', async () => {
      const providers = () => ({ v4: createV4Provider(SHARED_KEY), v3: createV3Provider() })
      const a = setupParty('a', { providers: providers(), channelSettings: v4Settings })
      const b = setupParty('b', { providers: providers() })
      const readyA = readyEvents(a)
      const readyB = readyEvents(b)

      a.channel.connect()
      b.channel.connect()
      await waitFor(() => readyA.length === 1 && readyB.length === 1)

      expect(transportProtocols(a, b)).toEqual(['v4', 'v4'])
    })
  })

  describe('plaintext pair', () => {
    it('opens without transports and exchanges plain product actions', () => {
      const a = setupParty('a')
      const b = setupParty('b')
      const messagesB: unknown[] = []
      b.channel.onMessage((message) => messagesB.push(message))
      a.channel.connect()
      b.channel.connect()

      a.channel.send('PING', { n: 1 })

      expect({ transports: transportProtocols(a, b), messagesB }).toEqual({
        transports: [null, null],
        messagesB: [expect.objectContaining({ type: 'PING', data: { n: 1 } })],
      })
    })
  })

  describe('fail-open fallback (default mode)', () => {
    it('falls back to plaintext when the responder holds no provider', () => {
      const a = setupParty('a', { providers: { v3: createV3Provider() }, channelSettings: v3Settings })
      const b = setupParty('b')
      const messagesB: unknown[] = []
      b.channel.onMessage((message) => messagesB.push(message))

      a.channel.connect()
      b.channel.connect()
      a.channel.send('PING', { n: 1 })

      expect({
        active: [a.channel.isActive(), b.channel.isActive()],
        transports: transportProtocols(a, b),
        messagesB,
      }).toEqual({
        active: [true, true],
        transports: [null, null],
        messagesB: [expect.objectContaining({ type: 'PING' })],
      })
    })

    it('falls back to plaintext when the initiator holds no provider for the protocol it asked for', () => {
      const a = setupParty('a', { channelSettings: v3Settings })
      const b = setupParty('b', { providers: { v3: createV3Provider() }, channelSettings: v3Settings })
      const messagesB: unknown[] = []
      b.channel.onMessage((message) => messagesB.push(message))

      a.channel.connect()
      b.channel.connect()
      a.channel.send('PING', { n: 1 })

      // note: the responder attached a v3 transport for its ACCEPT and released it when OPEN confirmed a plaintext outcome.
      expect({
        active: [a.channel.isActive(), b.channel.isActive()],
        transports: transportProtocols(a, b),
        openConfirmation: plaintextFramesTo(windowB).find((frame) => frame.type === ACTION_TYPES.OPEN_CONNECTION)?.security,
        messagesB,
      }).toEqual({
        active: [true, true],
        transports: [null, null],
        openConfirmation: { active: false, protocol: 'none' },
        messagesB: [expect.objectContaining({ type: 'PING' })],
      })
    })

    it('opens plaintext when the counterpart selects a protocol the channel did not ask for', () => {
      const a = setupParty('a', { providers: { v3: createV3Provider() }, channelSettings: v3Settings })
      const b = setupParty('b')

      a.channel.connect()
      simulateMessage(
        windowA,
        {
          type: ACTION_TYPES.ACCEPT_CONNECTION,
          processId: a.channel.getPendingProcessId() ?? '',
          senderId: b.broker.id,
          contract: contractB,
          security: { negotiated: 'v4' },
        } as IAction,
        'http://host-b.com',
        windowB
      )

      expect({
        active: a.channel.isActive(),
        transport: a.channel.getSecurityTransport(),
        openConfirmation: plaintextFramesTo(windowB).find((frame) => frame.type === ACTION_TYPES.OPEN_CONNECTION)?.security,
      }).toEqual({ active: true, transport: null, openConfirmation: { active: false, protocol: 'none' } })
    })
  })

  describe('fail-closed', () => {
    const failClosedV3: Partial<IChannelSettings> = { security: { protocol: 'v3', mode: 'fail-closed' } }

    it('aborts the initiator before OPEN when the responder negotiates down to plaintext', () => {
      const a = setupParty('a', { providers: { v3: createV3Provider() }, channelSettings: failClosedV3 })
      const b = setupParty('b')
      const denies = collectEvents(a.channel, ['deny'])

      a.channel.connect()
      b.channel.connect()

      expect({ active: [a.channel.isActive(), b.channel.isActive()], denies }).toEqual({
        active: [false, false],
        denies: [{ event: 'deny', data: expect.objectContaining({ reason: 'security-unavailable' }) }],
      })
    })

    it('denies a legacy initiator whose REQUEST carries no security slot, surfacing the deny on both ends', () => {
      const a = setupParty('a')
      const b = setupParty('b', { providers: { v3: createV3Provider() }, channelSettings: failClosedV3 })
      const deniesA = collectEvents(a.channel, ['deny'])
      const deniesB = collectEvents(b.channel, ['deny'])

      a.channel.connect()

      expect({ active: [a.channel.isActive(), b.channel.isActive()], deniesA, deniesB }).toEqual({
        active: [false, false],
        deniesA: [
          {
            event: 'deny',
            data: expect.objectContaining({ reason: 'security-unavailable', error: expect.stringContaining('Security is required') }),
          },
        ],
        deniesB: [
          {
            event: 'deny',
            data: expect.objectContaining({ reason: 'security-unavailable', error: expect.stringContaining('Security is required') }),
          },
        ],
      })
    })

    it('opens keyed when both fail-closed ends can negotiate the protocol', async () => {
      const settings: Partial<IChannelSettings> = { security: { protocol: 'v4', mode: 'fail-closed' } }
      const a = setupParty('a', { providers: { v4: createV4Provider(SHARED_KEY) }, channelSettings: settings })
      const b = setupParty('b', { providers: { v4: createV4Provider(SHARED_KEY) }, channelSettings: settings })
      const readyA = readyEvents(a)
      const readyB = readyEvents(b)

      a.channel.connect()
      b.channel.connect()
      await waitFor(() => readyA.length === 1 && readyB.length === 1)

      expect({ active: [a.channel.isActive(), b.channel.isActive()], protocols: transportProtocols(a, b) }).toEqual({
        active: [true, true],
        protocols: ['v4', 'v4'],
      })
    })

    it('denies with security-unavailable when a forged ACCEPT names a protocol the channel did not request', () => {
      const a = setupParty('a', { providers: { v3: createV3Provider() }, channelSettings: failClosedV3 })
      const b = setupParty('b')
      const denies = collectEvents(a.channel, ['deny'])

      a.channel.connect()
      simulateMessage(
        windowA,
        {
          type: ACTION_TYPES.ACCEPT_CONNECTION,
          processId: a.channel.getPendingProcessId() ?? '',
          senderId: b.broker.id,
          contract: contractB,
          security: { negotiated: 'v4' },
        } as IAction,
        'http://host-b.com',
        windowB
      )

      expect({ active: a.channel.isActive(), transport: a.channel.getSecurityTransport(), denies }).toEqual({
        active: false,
        transport: null,
        denies: [{ event: 'deny', data: expect.objectContaining({ reason: 'security-unavailable', origin: 'http://host-b.com' }) }],
      })
    })
  })

  describe('scheduled activation', () => {
    it('keys the session when the responder connects after the request arrived', async () => {
      const a = setupParty('a', { providers: { v3: createV3Provider() }, channelSettings: v3Settings })
      const b = setupParty('b', { providers: { v3: createV3Provider() }, channelSettings: v3Settings })
      const readyA = readyEvents(a)
      const readyB = readyEvents(b)

      a.channel.connect()
      const transportWhileScheduled = b.channel.getSecurityTransport()
      b.channel.connect()
      await waitFor(() => readyA.length === 1 && readyB.length === 1)

      // note: a request nobody has answered yet costs no session material; the transport appears when connect() composes the ACCEPT.
      expect({ transportWhileScheduled, protocols: transportProtocols(a, b), readyA, readyB }).toEqual({
        transportWhileScheduled: null,
        protocols: ['v3', 'v3'],
        readyA: readyOn('v3'),
        readyB: readyOn('v3'),
      })
    })

    it('denies a fail-closed responder whose provider vanished before it answered', () => {
      const a = setupParty('a', { providers: { v3: createV3Provider() }, channelSettings: v3Settings })
      const b = setupParty('b', {
        providers: { v3: createV3Provider() },
        channelSettings: { security: { protocol: 'v3', mode: 'fail-closed' } },
      })
      const deniesA = collectEvents(a.channel, ['deny'])
      const deniesB = collectEvents(b.channel, ['deny'])

      a.channel.connect()
      b.broker.unregisterProtocol('v3')
      b.channel.connect()

      expect({ active: [a.channel.isActive(), b.channel.isActive()], deniesA, deniesB }).toEqual({
        active: [false, false],
        deniesA: [
          {
            event: 'deny',
            data: {
              error: expect.stringContaining('no provider can serve the negotiated protocol'),
              reason: 'security-unavailable',
              origin: 'http://host-b.com',
            },
          },
        ],
        deniesB: [{ event: 'deny', data: expect.objectContaining({ reason: 'security-unavailable', origin: 'http://host-a.com' }) }],
      })
    })

    it('answers plaintext when a fail-open responder lost its provider before it answered', () => {
      const a = setupParty('a', { providers: { v3: createV3Provider() }, channelSettings: v3Settings })
      const b = setupParty('b', { providers: { v3: createV3Provider() }, channelSettings: v3Settings })
      const messagesB: unknown[] = []
      b.channel.onMessage((message) => messagesB.push(message))

      a.channel.connect()
      b.broker.unregisterProtocol('v3')
      b.channel.connect()
      a.channel.send('PING', { n: 1 })

      expect({
        active: [a.channel.isActive(), b.channel.isActive()],
        transports: transportProtocols(a, b),
        acceptResponse: plaintextFramesTo(windowA).find((frame) => frame.type === ACTION_TYPES.ACCEPT_CONNECTION)?.security,
        messagesB,
      }).toEqual({
        active: [true, true],
        transports: [null, null],
        acceptResponse: { negotiated: 'none' },
        messagesB: [expect.objectContaining({ type: 'PING' })],
      })
    })
  })

  describe('duplicate handshake frames', () => {
    it('replays ACCEPT and OPEN carrying the recorded protocol without re-keying', async () => {
      const a = setupParty('a', { providers: { v3: createV3Provider() }, channelSettings: v3Settings })
      const b = setupParty('b', { providers: { v3: createV3Provider() }, channelSettings: v3Settings })
      const readyA = readyEvents(a)
      const readyB = readyEvents(b)
      const opensB = collectEvents(b.channel, ['open'])
      a.channel.connect()
      b.channel.connect()
      await waitFor(() => readyA.length === 1 && readyB.length === 1)
      const transports = [a.channel.getSecurityTransport(), b.channel.getSecurityTransport()]
      const requestFrame = plaintextFramesTo(windowB)[0]
      windowA.postMessage.mockClear()
      windowB.postMessage.mockClear()

      simulateMessage(windowB, requestFrame, 'http://host-a.com', windowA)

      expect({
        toA: plaintextFramesTo(windowA),
        toB: plaintextFramesTo(windowB),
        opensB: opensB.length,
        sameTransports: [a.channel.getSecurityTransport() === transports[0], b.channel.getSecurityTransport() === transports[1]],
      }).toEqual({
        toA: [expect.objectContaining({ type: ACTION_TYPES.ACCEPT_CONNECTION, security: { negotiated: 'v3' } })],
        toB: [expect.objectContaining({ type: ACTION_TYPES.OPEN_CONNECTION, security: { active: true, protocol: 'v3' } })],
        opensB: 1,
        sameTransports: [true, true],
      })
    })
  })

  describe('plaintext outcome at OPEN', () => {
    it('refuses to open a fail-closed responder when the initiator confirms a plaintext outcome', () => {
      const a = setupParty('a', { channelSettings: v3Settings })
      const b = setupParty('b', {
        providers: { v3: createV3Provider() },
        channelSettings: { security: { protocol: 'v3', mode: 'fail-closed' } },
      })
      const eventsB = collectEvents(b.channel, ['deny', 'open'])

      // how: the initiator asks for v3 but holds no provider, so its OPEN confirms plaintext against the v3 the responder attached.
      a.channel.connect()
      b.channel.connect()

      expect({
        active: [a.channel.isActive(), b.channel.isActive()],
        transportB: b.channel.getSecurityTransport(),
        eventsB,
        cancelToA: plaintextTypesTo(windowA).includes(ACTION_TYPES.CANCEL_CONNECTION),
      }).toEqual({
        active: [false, false],
        transportB: null,
        eventsB: [
          {
            event: 'deny',
            data: { error: expect.stringContaining('could not activate'), reason: 'security-unavailable', origin: 'http://host-a.com' },
          },
        ],
        cancelToA: true,
      })
    })

    it('answers plaintext when the fail-open responder asked for a protocol it holds no provider for', () => {
      const a = setupParty('a', { providers: { v3: createV3Provider() }, channelSettings: v3Settings })
      const b = setupParty('b', { channelSettings: v3Settings })
      const messagesB: unknown[] = []
      b.channel.onMessage((message) => messagesB.push(message))

      a.channel.connect()
      b.channel.connect()
      a.channel.send('PING', { n: 1 })

      expect({
        active: [a.channel.isActive(), b.channel.isActive()],
        transports: transportProtocols(a, b),
        acceptResponse: plaintextFramesTo(windowA).find((frame) => frame.type === ACTION_TYPES.ACCEPT_CONNECTION)?.security,
        messagesB,
      }).toEqual({
        active: [true, true],
        transports: [null, null],
        acceptResponse: { negotiated: 'none' },
        messagesB: [expect.objectContaining({ type: 'PING' })],
      })
    })
  })

  describe('forged handshake frames', () => {
    it('drops an ACCEPT for a process the channel never requested with an invalid event', () => {
      const a = setupParty('a', { providers: { v3: createV3Provider() }, channelSettings: v3Settings })
      const b = setupParty('b')
      const invalidA = collectEvents(a.channel, ['invalid'])
      a.channel.connect()
      const requested = a.channel.getPendingProcessId()

      simulateMessage(
        windowA,
        {
          type: ACTION_TYPES.ACCEPT_CONNECTION,
          processId: 'forged-process',
          senderId: b.broker.id,
          contract: contractB,
          security: { negotiated: 'v3' },
        } as IAction,
        'http://host-b.com',
        windowB
      )

      expect({ invalidA, active: a.channel.isActive(), stillPending: a.channel.getPendingProcessId() === requested }).toEqual({
        invalidA: [
          {
            event: 'invalid',
            data: {
              error: "Dropped connection acceptance for unknown process 'forged-process'.",
              action: expect.objectContaining({ processId: 'forged-process' }),
            },
          },
        ],
        active: false,
        stillPending: true,
      })
    })
  })
})
