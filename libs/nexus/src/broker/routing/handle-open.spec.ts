import type { Logger } from '@hyperfrontend/logging'
import type { IAction } from '../../types/action'
import type { IChannelContract } from '../../types/contract'
import type { SecurityProvider, SecurityProtocolProvider } from '../../types/security'
import type { BrokerState } from '../types'
import type { RoutingContext } from './types'
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

  let mockLogger: Logger
  let mockBrokerState: BrokerState

  let registry: ReturnType<typeof createRegistry>
  let processManager: ReturnType<typeof createProcessManager>
  let actions: ReturnType<typeof createActionCreators>
  let mockWindow: Window
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
    }

    mockBrokerState = {
      id: 'broker-1',
      name: 'test-broker',
      window: <Window>global.window,
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
    mockWindow = <Window>(<unknown>{
      postMessage: jest.fn(),
    })

    routingContext = {
      state: mockBrokerState,
      registry,
      processManager,
      actions,
      logger: mockLogger,
      getSupportedProtocols: () => ['none'],
      getProtocol: () => undefined,
      routeAction: () => undefined,
    }
  })

  function addRespondingChannel(
    name = 'test-channel',
    target: Window = mockWindow,
    processId = 'process-1',
    settings: Record<string, unknown> = {}
  ) {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, name, target, settings)
    channel.beginResponse('remote-broker-1', 'http://example.com', peerContract, processId, {
      type: '[nexus] connection-request-accepted',
      processId,
      senderId: 'broker-1',
    })
    processManager.track(processId, channel)
    ;(<jest.Mock>target.postMessage).mockClear()
    return channel
  }

  function contextWithProvider() {
    const sent: unknown[] = []
    const provider: SecurityProvider = {
      createChannel: (label) => ({
        label,
        send: (origin: string, target: string, data: unknown) => {
          sent.push({ origin, target, data })
        },
        receive: () => undefined,
        stop: () => undefined,
        resume: () => undefined,
      }),
      protocolProvider: <SecurityProtocolProvider>(<unknown>(() => undefined)),
    }
    const context: RoutingContext = { ...routingContext, getProtocol: () => provider }
    return { context, sent }
  }

  function openEvent(processId = 'process-1', security?: unknown) {
    return <MessageEvent<IAction>>{
      data: <IAction>{
        type: '[nexus] connection-opened',
        processId,
        senderId: 'remote-broker-1',
        ...(security ? { security } : {}),
      },
      origin: 'http://example.com',
      source: mockWindow,
    }
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

  it('ignore if channel not found', () => {
    expect(() => {
      handleOpen(routingContext, openEvent('non-existent-process'))
    }).not.toThrow()
  })

  it('ignores an OPEN from another instance and keeps the process the answered one needs', () => {
    const channel = addRespondingChannel()
    const foreign = <MessageEvent<IAction>>{
      ...openEvent(),
      data: <IAction>{ type: '[nexus] connection-opened', processId: 'process-1', senderId: 'remote-broker-2' },
    }

    handleOpen(routingContext, foreign)
    handleOpen(routingContext, openEvent())

    expect({ active: channel.isActive(), peerId: channel.getPeerId() }).toEqual({ active: true, peerId: 'remote-broker-1' })
  })

  it('ignores OPEN when no accept is pending', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    processManager.track('process-1', channel)
    const openHandler = jest.fn()
    channel.on('open', openHandler)

    handleOpen(routingContext, openEvent())

    expect({ active: channel.isActive(), opens: openHandler.mock.calls.length }).toEqual({ active: false, opens: 0 })
  })

  it('ignores a duplicate OPEN once the process completed', () => {
    const channel = addRespondingChannel()
    const openHandler = jest.fn()
    channel.on('open', openHandler)

    handleOpen(routingContext, openEvent())
    handleOpen(routingContext, openEvent())

    expect(openHandler).toHaveBeenCalledTimes(1)
  })

  it('handles security confirmation and sets protocol', () => {
    const channel = addRespondingChannel()
    const securityReadyHandler = jest.fn()
    channel.on('security-ready', securityReadyHandler)

    handleOpen(contextWithProvider().context, openEvent('process-1', { protocol: 'v1', active: true }))

    expect({ negotiated: channel.getNegotiatedProtocol(), ready: channel.isSecurityReady() }).toEqual({
      negotiated: 'v1',
      ready: true,
    })
    expect(securityReadyHandler).toHaveBeenCalledWith({ protocol: 'v1', active: true }, expect.anything())
  })

  it('overwrites a previously negotiated protocol with the confirmed outcome', () => {
    const channel = addRespondingChannel()
    channel.setNegotiatedProtocol('v2')

    handleOpen(routingContext, openEvent('process-1', { protocol: 'none', active: false }))

    expect(channel.getNegotiatedProtocol()).toBe('none')
  })

  it('logs debug info when security is ready', () => {
    addRespondingChannel()

    handleOpen(routingContext, openEvent('process-1', { protocol: 'v2', active: true }))

    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('security ready'))
  })

  it('marks security ready for no security confirmation', () => {
    const channel = addRespondingChannel()

    handleOpen(routingContext, openEvent())

    expect(channel.isSecurityReady()).toBe(true)
  })

  describe('security transport attachment', () => {
    it('attaches the transport for the confirmed protocol', () => {
      const channel = addRespondingChannel()

      handleOpen(contextWithProvider().context, openEvent('process-1', { protocol: 'v2', active: true }))

      expect(channel.getSecurityTransport()?.getProtocol()).toBe('v2')
    })

    it('flushes queued product messages through the transport, not postMessage', () => {
      const channel = addRespondingChannel()
      channel.send('response-message', { seq: 1 })
      const wire = contextWithProvider()

      handleOpen(wire.context, openEvent('process-1', { protocol: 'v2', active: true }))

      expect({
        throughTransport: wire.sent,
        posts: (<jest.Mock>mockWindow.postMessage).mock.calls,
      }).toEqual({
        throughTransport: [
          expect.objectContaining({
            data: expect.objectContaining({ message: expect.objectContaining({ type: '[nexus] new-message' }) }),
          }),
        ],
        posts: [],
      })
    })

    it('warns and stays plaintext when no provider is registered for the confirmed protocol', () => {
      const channel = addRespondingChannel()

      handleOpen(routingContext, openEvent('process-1', { protocol: 'v2', active: true }))

      expect({
        negotiated: channel.getNegotiatedProtocol(),
        transport: channel.getSecurityTransport(),
        warns: (<jest.Mock>mockLogger.warn).mock.calls,
      }).toEqual({
        negotiated: 'none',
        transport: null,
        warns: [[expect.stringContaining("no provider registered for the negotiated 'v2' protocol")]],
      })
    })

    it('does not attach a transport when the confirmation reports inactive security', () => {
      const channel = addRespondingChannel()

      handleOpen(contextWithProvider().context, openEvent('process-1', { protocol: 'none', active: false }))

      expect(channel.getSecurityTransport()).toBeNull()
    })

    it('does not attach a transport on a stale OPEN with no pending accept', () => {
      const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
      processManager.track('process-1', channel)

      handleOpen(contextWithProvider().context, openEvent('process-1', { protocol: 'v2', active: true }))

      expect(channel.getSecurityTransport()).toBeNull()
    })
  })

  describe('fail-closed responder', () => {
    function addFailClosedChannel() {
      const channel = addRespondingChannel('test-channel', mockWindow, 'process-1', {
        security: { protocol: 'v2', mode: 'fail-closed' },
      })
      const denyHandler = jest.fn()
      channel.on('deny', denyHandler)
      return { channel, denyHandler }
    }

    it('refuses the open when the confirmation reports inactive security', () => {
      const { channel, denyHandler } = addFailClosedChannel()

      handleOpen(routingContext, openEvent('process-1', { protocol: 'none', active: false }))

      expect({
        active: channel.isActive(),
        cancel: (<jest.Mock>mockWindow.postMessage).mock.calls[0][0],
        deny: denyHandler.mock.calls[0][0],
      }).toEqual({
        active: false,
        cancel: expect.objectContaining({ type: '[nexus] connection-request-cancelled', processId: 'process-1' }),
        deny: expect.objectContaining({ reason: 'security-unavailable', origin: 'http://example.com' }),
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

    it('refuses the open when the confirmed provider is missing locally', () => {
      const { channel, denyHandler } = addFailClosedChannel()

      handleOpen(routingContext, openEvent('process-1', { protocol: 'v2', active: true }))

      expect({ active: channel.isActive(), deny: denyHandler.mock.calls[0][0] }).toEqual({
        active: false,
        deny: expect.objectContaining({ reason: 'security-unavailable' }),
      })
    })

    it('stops the ACCEPT replay timers after refusing', () => {
      addFailClosedChannel()

      handleOpen(routingContext, openEvent('process-1', { protocol: 'none', active: false }))
      ;(<jest.Mock>mockWindow.postMessage).mockClear()
      jest.advanceTimersByTime(20_000)

      expect(mockWindow.postMessage).not.toHaveBeenCalled()
    })

    it('completes the open when the confirmation delivers an encrypted transport', () => {
      const { channel } = addFailClosedChannel()

      handleOpen(contextWithProvider().context, openEvent('process-1', { protocol: 'v2', active: true }))

      expect({ active: channel.isActive(), transport: channel.getSecurityTransport()?.getProtocol() }).toEqual({
        active: true,
        transport: 'v2',
      })
    })
  })

  describe('fail-open responder wanting security', () => {
    it('warns and opens in plaintext when the initiator confirmed a plaintext outcome', () => {
      const channel = addRespondingChannel('test-channel', mockWindow, 'process-1', { security: { protocol: 'v2' } })

      handleOpen(routingContext, openEvent('process-1', { protocol: 'none', active: false }))

      expect({ active: channel.isActive(), warns: (<jest.Mock>mockLogger.warn).mock.calls }).toEqual({
        active: true,
        warns: [[expect.stringContaining('continuing without encryption')]],
      })
    })
  })

  it('handles multiple open events for different channels', () => {
    const channel1 = addRespondingChannel('channel-1', mockWindow, 'process-1')
    const window2 = <Window>(<unknown>{ postMessage: jest.fn() })
    const channel2 = addRespondingChannel('channel-2', window2, 'process-2')

    handleOpen(routingContext, openEvent('process-1'))
    handleOpen(routingContext, openEvent('process-2'))

    expect([channel1.isActive(), channel2.isActive()]).toEqual([true, true])
  })
})
