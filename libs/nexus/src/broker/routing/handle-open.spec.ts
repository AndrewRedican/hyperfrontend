import type { Logger } from '@hyperfrontend/logging'
import type { Mock } from '@hyperfrontend/testing'
import type { ChannelSecurityDependencies } from '../../channel/types'
import type { IAction } from '../../types/action'
import type { IChannelContract } from '../../types/contract'
import type { SecurityProtocolVersion, SecurityProvider, SecurityTransport, SecurityWireChannel } from '../../types/security'
import type { BrokerState } from '../types'
import type { RoutingContext } from './types'
import { after as afterAll, afterEach, before as beforeAll, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createActionCreators } from '../../core/actions/factory'
import { createProcessManager } from '../../core/processes/factory'
import { createRegistry } from '../../core/registry/factory'
import { addChannel } from '../channels/add'
import { handleOpen } from './handle-open'

describe('handleOpen', () => {
  const ownContract: IChannelContract = {
    accepted: [{ type: 'test-message', description: 'Test message' }],
    emitted: [{ type: 'response-message', description: 'Response message' }],
  }

  const peerContract: IChannelContract = {
    accepted: [{ type: 'response-message' }],
    emitted: [{ type: 'test-message' }],
  }

  const confirmedV4 = { active: true, protocol: 'v4' }
  const plaintextWarning =
    'test-broker requested security for channel test-channel but the counterpart confirmed a plaintext outcome; continuing without encryption.'

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
      getProvider: jest.fn((protocol: SecurityProtocolVersion) => (protocol === 'v4' ? provider : undefined)),
      dispatch: jest.fn(),
    }

    routingContext = {
      state: mockBrokerState,
      registry,
      processManager,
      actions,
      logger: mockLogger,
      getSupportedProtocols: () => ['v4', 'none'],
      security,
    }
  })

  function createMockTransport(protocol: SecurityProtocolVersion = 'v4'): SecurityTransport {
    return {
      send: jest.fn(),
      receive: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      resume: jest.fn(),
      dispose: jest.fn(),
      getProtocol: () => protocol,
    }
  }

  function addRespondingChannel(
    name = 'test-channel',
    target: Window = mockWindow,
    processId = 'process-1',
    settings: Record<string, unknown> = {}
  ) {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, name, target, settings, security)
    channel.beginResponse('remote-broker-1', 'http://example.com', peerContract, processId, {
      type: '[nexus] connection-request-accepted',
      processId,
      senderId: 'broker-1',
    })
    processManager.track(processId, channel)
    ;(target.postMessage as Mock).mockClear()
    return channel
  }

  function addSecuredChannel(settings: Record<string, unknown> = {}) {
    const channel = addRespondingChannel('test-channel', mockWindow, 'process-1', settings)
    const transport = createMockTransport()
    channel.setNegotiatedProtocol('v4')
    channel.setSecurityTransport(transport)
    return { channel, transport }
  }

  function openEvent(processId = 'process-1', security?: unknown) {
    return {
      data: {
        type: '[nexus] connection-opened',
        processId,
        senderId: 'remote-broker-1',
        ...(security ? { security } : {}),
      } as IAction,
      origin: 'http://example.com',
      source: mockWindow,
    } as MessageEvent<IAction>
  }

  it('activates the responder and removes the process', () => {
    const channel = addRespondingChannel()

    handleOpen(routingContext, openEvent())

    expect({ active: channel.isActive(), process: processManager.get('process-1') }).toEqual({
      active: true,
      process: undefined,
    })
  })

  it('keeps the own contract and stores the initiator contract as the peer contract', () => {
    const channel = addRespondingChannel()

    handleOpen(routingContext, openEvent())

    expect(channel.toJSON()).toEqual(expect.objectContaining({ contract: ownContract, peerContract, peerId: 'remote-broker-1' }))
  })

  it('fires open with the origin and peer contract', () => {
    const channel = addRespondingChannel()
    const openHandler = jest.fn()
    channel.on('open', openHandler)

    handleOpen(routingContext, openEvent())

    expect(openHandler).toHaveBeenCalledWith(
      expect.objectContaining({ origin: 'http://example.com', contract: peerContract }),
      expect.anything()
    )
  })

  it('logs the plaintext outcome when opening without security', () => {
    addRespondingChannel()

    handleOpen(routingContext, openEvent())

    expect(mockLogger.info).toHaveBeenCalledWith('test-broker opened channel test-channel: protocol=none')
  })

  it('stops the ACCEPT replay timers once OPEN arrives', () => {
    addRespondingChannel()

    handleOpen(routingContext, openEvent())
    jest.advanceTimersByTime(20_000)

    expect(mockWindow.postMessage).not.toHaveBeenCalled()
  })

  it('flushes queued messages on activation', () => {
    const channel = addRespondingChannel()
    channel.send('response-message', { seq: 1 })

    handleOpen(routingContext, openEvent())

    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: '[nexus] new-message', data: expect.objectContaining({ type: 'response-message' }) }),
      expect.any(String)
    )
  })

  it('ignores an OPEN for a process nobody tracks', () => {
    expect(() => {
      handleOpen(routingContext, openEvent('non-existent-process'))
    }).not.toThrow()
  })

  it('ignores an OPEN from another instance and keeps the process the answered one needs', () => {
    const channel = addRespondingChannel()
    const foreign = {
      ...openEvent(),
      data: { type: '[nexus] connection-opened', processId: 'process-1', senderId: 'remote-broker-2' } as IAction,
    } as MessageEvent<IAction>

    handleOpen(routingContext, foreign)
    handleOpen(routingContext, openEvent())

    expect({ active: channel.isActive(), peerId: channel.getPeerId() }).toEqual({ active: true, peerId: 'remote-broker-1' })
  })

  describe('no matching pending accept', () => {
    it('ignores OPEN when no accept is pending', () => {
      const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow, {}, security)
      processManager.track('process-1', channel)
      const openHandler = jest.fn()
      channel.on('open', openHandler)

      handleOpen(routingContext, openEvent())

      expect({ active: channel.isActive(), opens: openHandler.mock.calls.length }).toEqual({ active: false, opens: 0 })
    })

    it('removes the process before bailing when no accept is pending', () => {
      const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow, {}, security)
      processManager.track('process-1', channel)

      handleOpen(routingContext, openEvent())

      expect(processManager.get('process-1')).toBeUndefined()
    })

    it('ignores an OPEN whose process id is not the one this side accepted', () => {
      const channel = addRespondingChannel()
      processManager.track('process-2', channel)
      const openHandler = jest.fn()
      channel.on('open', openHandler)

      handleOpen(routingContext, openEvent('process-2'))

      expect({ active: channel.isActive(), opens: openHandler.mock.calls.length, awaiting: channel.isAwaitingOpen('process-1') }).toEqual({
        active: false,
        opens: 0,
        awaiting: true,
      })
    })

    it('removes the mismatching process while keeping the accepted one tracked', () => {
      const channel = addRespondingChannel()
      processManager.track('process-2', channel)

      handleOpen(routingContext, openEvent('process-2'))

      expect({ mismatching: processManager.get('process-2'), accepted: processManager.get('process-1') }).toEqual({
        mismatching: undefined,
        accepted: channel,
      })
    })

    it('leaves the transport attached when bailing on a mismatching process id', () => {
      const { channel, transport } = addSecuredChannel()
      processManager.track('process-2', channel)

      handleOpen(routingContext, openEvent('process-2', confirmedV4))

      expect({ transport: channel.getSecurityTransport(), disposed: (transport.dispose as Mock).mock.calls.length }).toEqual({
        transport,
        disposed: 0,
      })
    })

    it('ignores a duplicate OPEN once the process completed', () => {
      const channel = addRespondingChannel()
      const openHandler = jest.fn()
      channel.on('open', openHandler)

      handleOpen(routingContext, openEvent())
      handleOpen(routingContext, openEvent())

      expect(openHandler).toHaveBeenCalledTimes(1)
    })
  })

  describe('confirmed security outcome', () => {
    it('keeps the transport when the initiator confirms the negotiated protocol', () => {
      const { channel, transport } = addSecuredChannel()

      handleOpen(routingContext, openEvent('process-1', confirmedV4))

      expect({ transport: channel.getSecurityTransport(), disposed: (transport.dispose as Mock).mock.calls.length }).toEqual({
        transport,
        disposed: 0,
      })
    })

    it('keeps the negotiated protocol', () => {
      const { channel } = addSecuredChannel()

      handleOpen(routingContext, openEvent('process-1', confirmedV4))

      expect(channel.getNegotiatedProtocol()).toBe('v4')
    })

    it('activates the channel', () => {
      const { channel } = addSecuredChannel()

      handleOpen(routingContext, openEvent('process-1', confirmedV4))

      expect(channel.isActive()).toBe(true)
    })

    it('logs the confirmed protocol', () => {
      addSecuredChannel()

      handleOpen(routingContext, openEvent('process-1', confirmedV4))

      expect(mockLogger.info).toHaveBeenCalledWith('test-broker opened channel test-channel: protocol=v4')
    })

    it('flushes queued product messages through the kept transport', () => {
      const { channel, transport } = addSecuredChannel()
      channel.send('response-message', { seq: 1 })

      handleOpen(routingContext, openEvent('process-1', confirmedV4))

      expect({ sealed: (transport.send as Mock).mock.calls, posts: (mockWindow.postMessage as Mock).mock.calls }).toEqual({
        sealed: [[expect.objectContaining({ type: '[nexus] new-message' })]],
        posts: [],
      })
    })

    it('does not fire security-ready', () => {
      const { channel } = addSecuredChannel()
      const readyHandler = jest.fn()
      channel.on('security-ready', readyHandler)

      handleOpen(routingContext, openEvent('process-1', confirmedV4))

      expect(readyHandler).not.toHaveBeenCalled()
    })

    it('attaches no transport of its own', () => {
      const channel = addRespondingChannel()
      channel.setNegotiatedProtocol('v4')

      handleOpen(routingContext, openEvent('process-1', confirmedV4))

      expect({ created: (provider.createChannel as Mock).mock.calls.length, transport: channel.getSecurityTransport() }).toEqual({
        created: 0,
        transport: null,
      })
    })

    it('does not start the transport again', () => {
      const { transport } = addSecuredChannel()

      handleOpen(routingContext, openEvent('process-1', confirmedV4))

      expect(transport.start).not.toHaveBeenCalled()
    })
  })

  describe('unconfirmed security outcome', () => {
    it('drops the transport when the OPEN carries no confirmation', () => {
      const { channel, transport } = addSecuredChannel()

      handleOpen(routingContext, openEvent())

      expect({ transport: channel.getSecurityTransport(), disposed: (transport.dispose as Mock).mock.calls.length }).toEqual({
        transport: null,
        disposed: 1,
      })
    })

    it('records plaintext when the OPEN carries no confirmation', () => {
      const { channel } = addSecuredChannel()

      handleOpen(routingContext, openEvent())

      expect(channel.getNegotiatedProtocol()).toBe('none')
    })

    it('drops the transport when the confirmation reports inactive security', () => {
      const { channel, transport } = addSecuredChannel()

      handleOpen(routingContext, openEvent('process-1', { active: false, protocol: 'v4' }))

      expect({ transport: channel.getSecurityTransport(), disposed: (transport.dispose as Mock).mock.calls.length }).toEqual({
        transport: null,
        disposed: 1,
      })
    })

    it('drops the transport when the confirmation names another protocol', () => {
      const { channel, transport } = addSecuredChannel()

      handleOpen(routingContext, openEvent('process-1', { active: true, protocol: 'v3' }))

      expect({ transport: channel.getSecurityTransport(), disposed: (transport.dispose as Mock).mock.calls.length }).toEqual({
        transport: null,
        disposed: 1,
      })
    })

    it('records plaintext when the confirmation names another protocol', () => {
      const { channel } = addSecuredChannel()

      handleOpen(routingContext, openEvent('process-1', { active: true, protocol: 'v3' }))

      expect(channel.getNegotiatedProtocol()).toBe('none')
    })

    it('records plaintext when the initiator confirms a protocol this side never negotiated', () => {
      const channel = addRespondingChannel()

      handleOpen(routingContext, openEvent('process-1', confirmedV4))

      expect({ negotiated: channel.getNegotiatedProtocol(), active: channel.isActive() }).toEqual({ negotiated: 'none', active: true })
    })

    it('records plaintext when this side negotiated none and the initiator confirms a protocol', () => {
      const channel = addRespondingChannel()
      channel.setNegotiatedProtocol('none')

      handleOpen(routingContext, openEvent('process-1', confirmedV4))

      expect(channel.getNegotiatedProtocol()).toBe('none')
    })

    it('opens in plaintext after dropping the transport', () => {
      const { channel } = addSecuredChannel()
      channel.send('response-message', { seq: 1 })

      handleOpen(routingContext, openEvent())

      expect({
        active: channel.isActive(),
        postedTypes: (mockWindow.postMessage as Mock).mock.calls.map((call) => (call[0] as IAction).type),
      }).toEqual({
        active: true,
        postedTypes: ['[nexus] new-message'],
      })
    })

    it('logs the plaintext outcome', () => {
      addSecuredChannel()

      handleOpen(routingContext, openEvent())

      expect(mockLogger.info).toHaveBeenCalledWith('test-broker opened channel test-channel: protocol=none')
    })

    it('stays silent when the channel asked for no security', () => {
      addSecuredChannel()

      handleOpen(routingContext, openEvent())

      expect(mockLogger.warn).not.toHaveBeenCalled()
    })
  })

  describe('fail-closed responder', () => {
    const failClosedSettings = { security: { protocol: 'v4', mode: 'fail-closed' } }

    function addFailClosedChannel() {
      const { channel, transport } = addSecuredChannel(failClosedSettings)
      const denyHandler = jest.fn()
      channel.on('deny', denyHandler)
      return { channel, transport, denyHandler }
    }

    it('refuses the open when the confirmation reports inactive security', () => {
      const { channel, denyHandler } = addFailClosedChannel()

      handleOpen(routingContext, openEvent('process-1', { active: false, protocol: 'v4' }))

      expect({
        active: channel.isActive(),
        cancel: (mockWindow.postMessage as Mock).mock.calls[0][0],
        deny: denyHandler.mock.calls[0][0],
      }).toEqual({
        active: false,
        cancel: expect.objectContaining({ type: '[nexus] connection-request-cancelled', processId: 'process-1', senderId: 'broker-1' }),
        deny: {
          error: 'Security is required for this channel but the counterpart could not activate an encrypted protocol.',
          reason: 'security-unavailable',
          origin: 'http://example.com',
        },
      })
    })

    it('refuses the open when the OPEN carries no security confirmation', () => {
      const { channel, denyHandler } = addFailClosedChannel()

      handleOpen(routingContext, openEvent())

      expect({ active: channel.isActive(), deny: denyHandler.mock.calls[0][0] }).toEqual({
        active: false,
        deny: expect.objectContaining({ reason: 'security-unavailable' }),
      })
    })

    it('refuses the open when the confirmation names another protocol', () => {
      const { channel, denyHandler } = addFailClosedChannel()

      handleOpen(routingContext, openEvent('process-1', { active: true, protocol: 'v3' }))

      expect({ active: channel.isActive(), deny: denyHandler.mock.calls[0][0] }).toEqual({
        active: false,
        deny: expect.objectContaining({ reason: 'security-unavailable' }),
      })
    })

    it('refuses the open when nothing was negotiated', () => {
      const channel = addRespondingChannel('test-channel', mockWindow, 'process-1', failClosedSettings)
      const denyHandler = jest.fn()
      channel.on('deny', denyHandler)

      handleOpen(routingContext, openEvent('process-1', confirmedV4))

      expect({ active: channel.isActive(), deny: denyHandler.mock.calls[0][0] }).toEqual({
        active: false,
        deny: expect.objectContaining({ reason: 'security-unavailable' }),
      })
    })

    it('releases the transport before refusing', () => {
      const { channel, transport } = addFailClosedChannel()

      handleOpen(routingContext, openEvent())

      expect({ transport: channel.getSecurityTransport(), disposed: (transport.dispose as Mock).mock.calls.length }).toEqual({
        transport: null,
        disposed: 1,
      })
    })

    it('sends the CANCEL frame in plaintext', () => {
      addFailClosedChannel()

      handleOpen(routingContext, openEvent())

      expect((mockWindow.postMessage as Mock).mock.calls.map((call) => (call[0] as IAction).type)).toEqual([
        '[nexus] connection-request-cancelled',
      ])
    })

    it('logs a warning naming the channel when refusing', () => {
      addFailClosedChannel()

      handleOpen(routingContext, openEvent())

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'test-broker refused to open the test-channel channel: security is required but unavailable.'
      )
    })

    it('does not warn about continuing without encryption when refusing', () => {
      addFailClosedChannel()

      handleOpen(routingContext, openEvent())

      expect((mockLogger.warn as Mock).mock.calls).toEqual([[expect.stringContaining('refused to open')]])
    })

    it('fires cancel before deny when refusing', () => {
      const { channel } = addFailClosedChannel()
      const events = jest.fn()
      channel.on((event) => events(event))

      handleOpen(routingContext, openEvent())

      expect(events.mock.calls.map((call) => call[0])).toEqual(['cancel', 'deny'])
    })

    it('fires no open event when refusing', () => {
      const { channel } = addFailClosedChannel()
      const openHandler = jest.fn()
      channel.on('open', openHandler)

      handleOpen(routingContext, openEvent())

      expect(openHandler).not.toHaveBeenCalled()
    })

    it('stops the ACCEPT replay timers after refusing', () => {
      addFailClosedChannel()

      handleOpen(routingContext, openEvent('process-1', { active: false, protocol: 'v4' }))
      ;(mockWindow.postMessage as Mock).mockClear()
      jest.advanceTimersByTime(20_000)

      expect(mockWindow.postMessage).not.toHaveBeenCalled()
    })

    it('leaves the process untracked after refusing', () => {
      addFailClosedChannel()

      handleOpen(routingContext, openEvent())

      expect(processManager.get('process-1')).toBeUndefined()
    })

    it('completes the open when the initiator confirms the negotiated protocol', () => {
      const { channel, transport } = addFailClosedChannel()

      handleOpen(routingContext, openEvent('process-1', confirmedV4))

      expect({ active: channel.isActive(), transport: channel.getSecurityTransport() }).toEqual({ active: true, transport })
    })
  })

  describe('fail-open responder wanting security', () => {
    const wantsV4 = { security: { protocol: 'v4' } }
    const plaintextOutcomes: Array<[string, unknown]> = [
      ['the initiator confirmed a plaintext outcome', { active: false, protocol: 'none' }],
      ['the OPEN carries no confirmation', undefined],
      ['the confirmation names another protocol', { active: true, protocol: 'v3' }],
    ]

    for (const [outcome, confirmation] of plaintextOutcomes) {
      it(`warns and opens in plaintext when ${outcome}`, () => {
        const { channel } = addSecuredChannel(wantsV4)

        handleOpen(routingContext, openEvent('process-1', confirmation))

        expect({ active: channel.isActive(), warns: (mockLogger.warn as Mock).mock.calls }).toEqual({
          active: true,
          warns: [[plaintextWarning]],
        })
      })
    }

    it('stays silent when the initiator confirms the negotiated protocol', () => {
      addSecuredChannel(wantsV4)

      handleOpen(routingContext, openEvent('process-1', confirmedV4))

      expect(mockLogger.warn).not.toHaveBeenCalled()
    })
  })

  it('handles multiple open events for different channels', () => {
    const channel1 = addRespondingChannel('channel-1', mockWindow, 'process-1')
    const window2 = { postMessage: jest.fn() } as unknown as Window
    const channel2 = addRespondingChannel('channel-2', window2, 'process-2')

    handleOpen(routingContext, openEvent('process-1'))
    handleOpen(routingContext, openEvent('process-2'))

    expect([channel1.isActive(), channel2.isActive()]).toEqual([true, true])
  })
})
