import type { Logger } from '@hyperfrontend/logging'
import type { Mock } from '@hyperfrontend/testing'
import type { ChannelSecurityDependencies } from '../../channel/types'
import type { IAction } from '../../types/action'
import type { IChannelContract } from '../../types/contract'
import type { SecurityProtocolVersion, SecurityProvider, SecurityWireChannel } from '../../types/security'
import type { BrokerState } from '../types'
import type { RoutingContext } from './types'
import { after as afterAll, afterEach, before as beforeAll, beforeEach } from 'node:test'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createActionCreators } from '../../core/actions/factory'
import { createProcessManager } from '../../core/processes/factory'
import { createRegistry } from '../../core/registry/factory'
import { addChannel } from '../channels/add'
import { handleAccept } from './handle-accept'

describe('handleAccept security settlement', () => {
  const ownContract: IChannelContract = {
    accepted: [{ type: 'test-message', description: 'Test message', required: true }],
    emitted: [{ type: 'response-message', description: 'Response message' }],
  }

  const peerContract: IChannelContract = {
    accepted: [{ type: 'response-message' }],
    emitted: [{ type: 'test-message' }],
  }

  const wantsV4 = { security: { protocol: 'v4' } }
  const missingProviderWarning = "test-broker has no working provider for the negotiated 'v4' protocol."
  const plaintextWarning =
    'test-broker requested security for channel test-channel but negotiation ended in plaintext; continuing without encryption.'

  let mockLogger: Logger
  let mockBrokerState: BrokerState

  let registry: ReturnType<typeof createRegistry>
  let processManager: ReturnType<typeof createProcessManager>
  let actions: ReturnType<typeof createActionCreators>
  let mockWindow: Window
  let wire: SecurityWireChannel
  let provider: SecurityProvider
  let security: ChannelSecurityDependencies
  let routingContext: RoutingContext

  beforeAll(() => {
    jest.useFakeTimers()
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      setLogLevel: jest.fn(),
      getLogLevel: jest.fn(() => 'debug'),
    } as unknown as Logger

    mockBrokerState = {
      id: 'broker-1',
      name: 'test-broker',
      window: global.window as Window,
      contract: ownContract,
      settings: {
        contract: ownContract,
      },
      logger: mockLogger,
    }

    registry = createRegistry()
    processManager = createProcessManager()
    actions = createActionCreators({
      getBrokerId: () => 'broker-1',
      getContract: () => mockBrokerState.contract,
    })
    mockWindow = {
      postMessage: jest.fn(),
    } as unknown as Window

    wire = {
      label: 'wire',
      send: jest.fn(),
      receive: jest.fn(),
      stop: jest.fn(),
      resume: jest.fn(),
      hello: jest.fn(async () => new Uint8Array([1])),
      isHello: jest.fn(() => false),
      acceptHello: jest.fn(() => 'accepted'),
    }
    provider = { createChannel: jest.fn(() => wire), protocolProvider: jest.fn() }
    security = {
      localId: 'broker-1',
      getProvider: jest.fn((protocol: SecurityProtocolVersion) => (protocol === 'v4' || protocol === 'v3' ? provider : undefined)),
      dispatch: jest.fn(),
    }

    routingContext = {
      state: mockBrokerState,
      registry,
      processManager,
      actions,
      logger: mockLogger,
      getSupportedProtocols: () => ['v4', 'v3', 'none'],
      security,
    }
  })

  function acceptEvent(processId: string, negotiated?: SecurityProtocolVersion) {
    return {
      data: {
        type: '[nexus] connection-request-accepted',
        processId,
        senderId: 'remote-broker-1',
        contract: peerContract,
        ...(negotiated ? { security: { negotiated } } : {}),
      } as IAction,
      origin: 'http://remote.example',
      source: mockWindow,
    } as MessageEvent<IAction>
  }

  function addRequestingChannel(settings: Record<string, unknown> = {}) {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow, settings, security)
    channel.connect()
    const processId = channel.getPendingProcessId()
    if (processId === null) throw new Error('connect() did not record a pending process')
    ;(mockWindow.postMessage as Mock).mockClear()
    return { channel, processId }
  }

  function postedTypes() {
    return (mockWindow.postMessage as Mock).mock.calls.map((call) => (call[0] as IAction).type)
  }

  function openedSecurity() {
    return ((mockWindow.postMessage as Mock).mock.calls[0][0] as IAction & { security?: unknown }).security
  }

  describe('protocol the channel asked for', () => {
    it('attaches the transport as initiator between the broker and the responder', () => {
      const { processId } = addRequestingChannel(wantsV4)

      handleAccept(routingContext, acceptEvent(processId, 'v4'))

      expect(provider.createChannel).toHaveBeenCalledWith(
        'test-channel',
        expect.objectContaining({ session: { protocol: 'v4', role: 'initiator', localId: 'broker-1', peerId: 'remote-broker-1' } })
      )
    })

    it('holds the transport for the settled protocol', () => {
      const { channel, processId } = addRequestingChannel(wantsV4)

      handleAccept(routingContext, acceptEvent(processId, 'v4'))

      expect(channel.getSecurityTransport()?.getProtocol()).toBe('v4')
    })

    it('records the settled protocol on the channel', () => {
      const { channel, processId } = addRequestingChannel(wantsV4)

      handleAccept(routingContext, acceptEvent(processId, 'v4'))

      expect(channel.getNegotiatedProtocol()).toBe('v4')
    })

    it('logs the accepted security protocol', () => {
      const { processId } = addRequestingChannel(wantsV4)

      handleAccept(routingContext, acceptEvent(processId, 'v4'))

      expect(mockLogger.info).toHaveBeenCalledWith('test-broker accepted security protocol: v4')
    })

    it('confirms the attached protocol in the OPEN', () => {
      const { processId } = addRequestingChannel(wantsV4)

      handleAccept(routingContext, acceptEvent(processId, 'v4'))

      expect(openedSecurity()).toEqual({ active: true, protocol: 'v4' })
    })

    it('keeps the OPEN confirmation plaintext on the wire', () => {
      const { processId } = addRequestingChannel(wantsV4)

      handleAccept(routingContext, acceptEvent(processId, 'v4'))

      expect(mockWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: '[nexus] connection-opened' }),
        expect.any(String)
      )
    })

    it('starts the hello exchange after OPEN leaves', () => {
      const { processId } = addRequestingChannel(wantsV4)

      handleAccept(routingContext, acceptEvent(processId, 'v4'))

      expect({ hellos: (wire.hello as Mock).mock.calls.length, postedTypes: postedTypes() }).toEqual({
        hellos: 1,
        postedTypes: ['[nexus] connection-opened'],
      })
    })

    it('flushes queued product messages through the transport, not postMessage', () => {
      const { channel, processId } = addRequestingChannel(wantsV4)
      channel.send('response-message', { seq: 1 })

      handleAccept(routingContext, acceptEvent(processId, 'v4'))

      expect({ sealed: (wire.send as Mock).mock.calls, postedTypes: postedTypes() }).toEqual({
        sealed: [
          ['broker-1', 'remote-broker-1', expect.objectContaining({ message: expect.objectContaining({ type: '[nexus] new-message' }) })],
        ],
        postedTypes: ['[nexus] connection-opened'],
      })
    })

    it('does not fire security-ready during the handshake', () => {
      const { channel, processId } = addRequestingChannel(wantsV4)
      const readyHandler = jest.fn()
      channel.on('security-ready', readyHandler)

      handleAccept(routingContext, acceptEvent(processId, 'v4'))

      expect(readyHandler).not.toHaveBeenCalled()
    })

    it('activates the channel', () => {
      const { channel, processId } = addRequestingChannel(wantsV4)

      handleAccept(routingContext, acceptEvent(processId, 'v4'))

      expect(channel.isActive()).toBe(true)
    })
  })

  describe('plaintext outcome', () => {
    it('confirms plaintext in the OPEN when the counterpart negotiated none', () => {
      const { processId } = addRequestingChannel()

      handleAccept(routingContext, acceptEvent(processId, 'none'))

      expect(openedSecurity()).toEqual({ active: false, protocol: 'none' })
    })

    it('records none when the counterpart negotiated none', () => {
      const { channel, processId } = addRequestingChannel()

      handleAccept(routingContext, acceptEvent(processId, 'none'))

      expect({ negotiated: channel.getNegotiatedProtocol(), transport: channel.getSecurityTransport() }).toEqual({
        negotiated: 'none',
        transport: null,
      })
    })

    it('logs the plaintext outcome', () => {
      const { processId } = addRequestingChannel()

      handleAccept(routingContext, acceptEvent(processId, 'none'))

      expect(mockLogger.info).toHaveBeenCalledWith('test-broker accepted security protocol: none')
    })

    it('attaches no transport when the counterpart negotiated none', () => {
      const { processId } = addRequestingChannel()

      handleAccept(routingContext, acceptEvent(processId, 'none'))

      expect(provider.createChannel).not.toHaveBeenCalled()
    })

    it('omits the confirmation from the OPEN when the ACCEPT carried no security slot', () => {
      const { processId } = addRequestingChannel()

      handleAccept(routingContext, acceptEvent(processId))

      expect(openedSecurity()).toBeUndefined()
    })

    it('records no protocol when the ACCEPT carried no security slot', () => {
      const { channel, processId } = addRequestingChannel()

      handleAccept(routingContext, acceptEvent(processId))

      expect(channel.getNegotiatedProtocol()).toBeNull()
    })
  })

  describe('protocol the channel did not ask for', () => {
    it('warns when the counterpart selects a protocol other than the requested one', () => {
      const { processId } = addRequestingChannel(wantsV4)

      handleAccept(routingContext, acceptEvent(processId, 'v3'))

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "test-broker ignored the 'v3' protocol the counterpart selected for channel test-channel: the channel asked for 'v4'."
      )
    })

    it('attaches no transport for the ignored protocol', () => {
      const { processId } = addRequestingChannel(wantsV4)

      handleAccept(routingContext, acceptEvent(processId, 'v3'))

      expect(provider.createChannel).not.toHaveBeenCalled()
    })

    it('settles on plaintext after ignoring the protocol', () => {
      const { channel, processId } = addRequestingChannel(wantsV4)

      handleAccept(routingContext, acceptEvent(processId, 'v3'))

      expect({ negotiated: channel.getNegotiatedProtocol(), security: openedSecurity() }).toEqual({
        negotiated: 'none',
        security: { active: false, protocol: 'none' },
      })
    })

    it('ignores an encrypted outcome when the channel asked for none', () => {
      const { channel, processId } = addRequestingChannel()

      handleAccept(routingContext, acceptEvent(processId, 'v4'))

      expect({ negotiated: channel.getNegotiatedProtocol(), warns: (mockLogger.warn as Mock).mock.calls }).toEqual({
        negotiated: 'none',
        warns: [["test-broker ignored the 'v4' protocol the counterpart selected for channel test-channel: the channel asked for 'none'."]],
      })
    })

    it('ignores an encrypted outcome when the channel disabled security', () => {
      const { channel, processId } = addRequestingChannel({ security: { protocol: 'v4', disabled: true } })

      handleAccept(routingContext, acceptEvent(processId, 'v4'))

      expect({ negotiated: channel.getNegotiatedProtocol(), created: (provider.createChannel as Mock).mock.calls.length }).toEqual({
        negotiated: 'none',
        created: 0,
      })
    })
  })

  describe('provider unavailable', () => {
    it('warns when no provider can serve the negotiated protocol', () => {
      const { processId } = addRequestingChannel(wantsV4)
      ;(security.getProvider as Mock).mockReturnValue(undefined)

      handleAccept(routingContext, acceptEvent(processId, 'v4'))

      expect(mockLogger.warn).toHaveBeenCalledWith(missingProviderWarning)
    })

    it('settles on plaintext when no provider can serve the negotiated protocol', () => {
      const { channel, processId } = addRequestingChannel(wantsV4)
      ;(security.getProvider as Mock).mockReturnValue(undefined)

      handleAccept(routingContext, acceptEvent(processId, 'v4'))

      expect({
        negotiated: channel.getNegotiatedProtocol(),
        transport: channel.getSecurityTransport(),
        security: openedSecurity(),
      }).toEqual({
        negotiated: 'none',
        transport: null,
        security: { active: false, protocol: 'none' },
      })
    })

    it('settles on plaintext when the provider refuses the session', () => {
      const { channel, processId } = addRequestingChannel(wantsV4)
      ;(provider.createChannel as Mock).mockImplementation(() => {
        throw createError('session refused')
      })

      handleAccept(routingContext, acceptEvent(processId, 'v4'))

      expect({ negotiated: channel.getNegotiatedProtocol(), security: openedSecurity() }).toEqual({
        negotiated: 'none',
        security: { active: false, protocol: 'none' },
      })
    })

    it('warns about the refused session before degrading', () => {
      const { processId } = addRequestingChannel(wantsV4)
      ;(provider.createChannel as Mock).mockImplementation(() => {
        throw createError('session refused')
      })

      handleAccept(routingContext, acceptEvent(processId, 'v4'))

      expect((mockLogger.warn as Mock).mock.calls).toEqual([
        ["Cannot attach the 'v4' security transport to channel test-channel: session refused"],
        [missingProviderWarning],
        [plaintextWarning],
      ])
    })
  })

  describe('fail-open initiator wanting security', () => {
    it('warns and opens in plaintext when the responder negotiated down to none', () => {
      const { channel, processId } = addRequestingChannel(wantsV4)

      handleAccept(routingContext, acceptEvent(processId, 'none'))

      expect({ active: channel.isActive(), warns: (mockLogger.warn as Mock).mock.calls }).toEqual({
        active: true,
        warns: [[plaintextWarning]],
      })
    })

    it('warns and opens in plaintext when the responder selected another protocol', () => {
      const { channel, processId } = addRequestingChannel(wantsV4)

      handleAccept(routingContext, acceptEvent(processId, 'v3'))

      expect({ active: channel.isActive(), warns: (mockLogger.warn as Mock).mock.calls }).toEqual({
        active: true,
        warns: [[expect.stringContaining("ignored the 'v3' protocol")], [plaintextWarning]],
      })
    })

    it('warns and opens in plaintext when the negotiated provider is missing', () => {
      const { channel, processId } = addRequestingChannel(wantsV4)
      ;(security.getProvider as Mock).mockReturnValue(undefined)

      handleAccept(routingContext, acceptEvent(processId, 'v4'))

      expect({ active: channel.isActive(), warns: (mockLogger.warn as Mock).mock.calls }).toEqual({
        active: true,
        warns: [[missingProviderWarning], [plaintextWarning]],
      })
    })

    it('warns and opens in plaintext when the responder predates security negotiation', () => {
      const { channel, processId } = addRequestingChannel(wantsV4)

      handleAccept(routingContext, acceptEvent(processId))

      expect({ active: channel.isActive(), warns: (mockLogger.warn as Mock).mock.calls }).toEqual({
        active: true,
        warns: [
          [
            'test-broker requested security for channel test-channel but the counterpart predates security negotiation; continuing without encryption.',
          ],
        ],
      })
    })

    it('stays silent when the channel asked for no security and the responder negotiated none', () => {
      const { processId } = addRequestingChannel()

      handleAccept(routingContext, acceptEvent(processId, 'none'))

      expect(mockLogger.warn).not.toHaveBeenCalled()
    })

    it('stays silent when the channel asked for no security and the ACCEPT carried no security slot', () => {
      const { processId } = addRequestingChannel()

      handleAccept(routingContext, acceptEvent(processId))

      expect(mockLogger.warn).not.toHaveBeenCalled()
    })
  })
})
