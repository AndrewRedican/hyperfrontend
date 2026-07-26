import type { IChannelSettings } from '../types/channel'
import type { SecurityProvider } from '../types/security'
import type { MockWindow } from './test-utils'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { logger } from '@hyperfrontend/logging'
import { createChannel } from '@hyperfrontend/network-protocol/browser/channel'
import { createProtocol as createV1Protocol } from '@hyperfrontend/network-protocol/browser/v1'
import { createProtocol as createV2Protocol } from '@hyperfrontend/network-protocol/browser/v2'
import { createBroker } from '../broker/factory'
import { ACTION_TYPES } from '../types/action'
import { createMockWindow, linkMockWindows, createContractPair } from './test-utils'

const PSK = 'security-negotiation-spec-shared-key'

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

describe('Integration: Security Negotiation and Attachment', () => {
  const { contractA, contractB } = createContractPair(['PING'], ['PONG'])

  let windowA: MockWindow
  let windowB: MockWindow

  beforeEach(() => {
    windowA = createMockWindow()
    windowB = createMockWindow()
    linkMockWindows(windowA, windowB, 'http://host-a.com', 'http://host-b.com')
  })

  interface PartyOptions {
    providers?: { v1?: SecurityProvider; v2?: SecurityProvider }
    channelSettings?: Partial<IChannelSettings>
  }

  function setupParty(name: 'a' | 'b', options: PartyOptions = {}) {
    const ownWindow = name === 'a' ? windowA : windowB
    const counterpartWindow = name === 'a' ? windowB : windowA
    const broker = createBroker({
      name: `broker-${name}`,
      contract: name === 'a' ? contractA : contractB,
      window: <Window>(<unknown>ownWindow),
      settings: options.providers ? { security: { protocols: options.providers } } : {},
    })
    const channel = broker.addChannel(`to-${name === 'a' ? 'b' : 'a'}`, <Window>(<unknown>counterpartWindow), options.channelSettings ?? {})
    return { broker, channel }
  }

  const framesTo = (target: MockWindow) => target.postMessage.mock.calls.map((call) => <unknown>call[0])

  const plaintextTypesTo = (target: MockWindow) =>
    framesTo(target)
      .filter((frame) => !(frame instanceof Uint8Array))
      .map((frame) => (<{ type: string }>frame).type)

  describe('v2 pair', () => {
    const v2Settings: Partial<IChannelSettings> = { security: { protocol: 'v2' } }

    function connectV2Pair() {
      const a = setupParty('a', { providers: { v2: createV2Provider() }, channelSettings: v2Settings })
      const b = setupParty('b', { providers: { v2: createV2Provider() }, channelSettings: v2Settings })
      a.channel.connect()
      b.channel.connect()
      return { a, b }
    }

    it('attaches a v2 transport on both ends after open', () => {
      const { a, b } = connectV2Pair()

      expect({
        aActive: a.channel.isActive(),
        bActive: b.channel.isActive(),
        aProtocol: a.channel.getSecurityTransport()?.getProtocol(),
        bProtocol: b.channel.getSecurityTransport()?.getProtocol(),
      }).toEqual({ aActive: true, bActive: true, aProtocol: 'v2', bProtocol: 'v2' })
    })

    it('keeps the handshake frames plaintext on the wire', () => {
      connectV2Pair()

      expect({ toB: plaintextTypesTo(windowB), toA: plaintextTypesTo(windowA) }).toEqual({
        toB: [ACTION_TYPES.REQUEST_CONNECTION, ACTION_TYPES.OPEN_CONNECTION],
        toA: [ACTION_TYPES.ACCEPT_CONNECTION],
      })
    })

    it('transmits product actions as Uint8Array ciphertext and delivers them decrypted, both directions', async () => {
      const { a, b } = connectV2Pair()
      const messagesA: unknown[] = []
      const messagesB: unknown[] = []
      // how: onMessage also echoes the channel's own outbound sends, so each collector keeps only the inbound type.
      a.channel.onMessage((message) => message.type === 'PONG' && messagesA.push(message))
      b.channel.onMessage((message) => message.type === 'PING' && messagesB.push(message))
      windowA.postMessage.mockClear()
      windowB.postMessage.mockClear()

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

    it('does not expose product action plaintext on the wire', async () => {
      const { a, b } = connectV2Pair()
      const messagesB: unknown[] = []
      b.channel.onMessage((message) => messagesB.push(message))
      windowB.postMessage.mockClear()

      a.channel.send('PING', { secret: 'classified-payload' })
      await waitFor(() => messagesB.length === 1)

      const wireFrame = <Uint8Array>framesTo(windowB)[0]
      expect(new TextDecoder().decode(wireFrame)).not.toContain('classified-payload')
    })

    it('flushes sends queued before the handshake as ciphertext after open', async () => {
      const a = setupParty('a', { providers: { v2: createV2Provider() }, channelSettings: v2Settings })
      const b = setupParty('b', { providers: { v2: createV2Provider() }, channelSettings: v2Settings })
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

  describe('v1 pair', () => {
    it('negotiates v1 and delivers product actions encrypted in both directions', async () => {
      const settings: Partial<IChannelSettings> = { security: { protocol: 'v1' } }
      const a = setupParty('a', { providers: { v1: createV1Provider() }, channelSettings: settings })
      const b = setupParty('b', { providers: { v1: createV1Provider() }, channelSettings: settings })
      const messagesA: unknown[] = []
      const messagesB: unknown[] = []
      // how: onMessage also echoes the channel's own outbound sends, so each collector keeps only the inbound type.
      a.channel.onMessage((message) => message.type === 'PONG' && messagesA.push(message))
      b.channel.onMessage((message) => message.type === 'PING' && messagesB.push(message))
      a.channel.connect()
      b.channel.connect()
      windowA.postMessage.mockClear()
      windowB.postMessage.mockClear()

      a.channel.send('PING', { n: 1 })
      await waitFor(() => messagesB.length === 1)
      b.channel.send('PONG', { n: 2 })
      await waitFor(() => messagesA.length === 1)

      expect({
        aProtocol: a.channel.getSecurityTransport()?.getProtocol(),
        toB: framesTo(windowB),
        toA: framesTo(windowA),
        messagesA,
        messagesB,
      }).toEqual({
        aProtocol: 'v1',
        toB: [expect.any(Uint8Array)],
        toA: [expect.any(Uint8Array)],
        messagesA: [expect.objectContaining({ type: 'PONG' })],
        messagesB: [expect.objectContaining({ type: 'PING' })],
      })
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

      expect({
        transports: [a.channel.getSecurityTransport(), b.channel.getSecurityTransport()],
        messagesB,
      }).toEqual({
        transports: [null, null],
        messagesB: [expect.objectContaining({ type: 'PING', data: { n: 1 } })],
      })
    })
  })

  describe('fail-open fallback (default mode)', () => {
    it('falls back to plaintext when the responder cannot negotiate the protocol', () => {
      const a = setupParty('a', { providers: { v2: createV2Provider() }, channelSettings: { security: { protocol: 'v2' } } })
      const b = setupParty('b')
      const messagesB: unknown[] = []
      b.channel.onMessage((message) => messagesB.push(message))

      a.channel.connect()
      b.channel.connect()
      a.channel.send('PING', { n: 1 })

      expect({
        aActive: a.channel.isActive(),
        bActive: b.channel.isActive(),
        aTransport: a.channel.getSecurityTransport(),
        messagesB,
      }).toEqual({
        aActive: true,
        bActive: true,
        aTransport: null,
        messagesB: [expect.objectContaining({ type: 'PING' })],
      })
    })
  })

  describe('fail-closed', () => {
    it('aborts the initiator before OPEN when the responder negotiates down to plaintext', () => {
      const a = setupParty('a', {
        providers: { v2: createV2Provider() },
        channelSettings: { security: { protocol: 'v2', mode: 'fail-closed' } },
      })
      const b = setupParty('b')
      const denyHandler = jest.fn()
      a.channel.on('deny', denyHandler)

      a.channel.connect()
      b.channel.connect()

      expect({ aActive: a.channel.isActive(), bActive: b.channel.isActive(), deny: denyHandler.mock.calls[0][0] }).toEqual({
        aActive: false,
        bActive: false,
        deny: expect.objectContaining({ reason: 'security-unavailable' }),
      })
    })

    it('denies a legacy initiator whose REQUEST carries no security slot', () => {
      const a = setupParty('a')
      const b = setupParty('b', {
        providers: { v2: createV2Provider() },
        channelSettings: { security: { protocol: 'v2', mode: 'fail-closed' } },
      })
      const denyHandler = jest.fn()
      a.channel.on('deny', denyHandler)

      a.channel.connect()

      expect({ aActive: a.channel.isActive(), bActive: b.channel.isActive(), deny: denyHandler.mock.calls[0][0] }).toEqual({
        aActive: false,
        bActive: false,
        deny: expect.objectContaining({ reason: 'security-unavailable', error: expect.stringContaining('Security is required') }),
      })
    })

    it('opens encrypted when both fail-closed ends can negotiate the protocol', () => {
      const settings: Partial<IChannelSettings> = { security: { protocol: 'v2', mode: 'fail-closed' } }
      const a = setupParty('a', { providers: { v2: createV2Provider() }, channelSettings: settings })
      const b = setupParty('b', { providers: { v2: createV2Provider() }, channelSettings: settings })

      a.channel.connect()
      b.channel.connect()

      expect({
        aActive: a.channel.isActive(),
        bActive: b.channel.isActive(),
        aProtocol: a.channel.getSecurityTransport()?.getProtocol(),
        bProtocol: b.channel.getSecurityTransport()?.getProtocol(),
      }).toEqual({ aActive: true, bActive: true, aProtocol: 'v2', bProtocol: 'v2' })
    })
  })
})
