import type { Logger } from '@hyperfrontend/logging'
import type { BrokerState } from '../../broker/types'
import type { ActionCreators } from '../../core/actions/factory'
import type { ChannelHandle } from '../../types/channel'
import type { IChannelContract } from '../../types/contract'
import type { SecurityProtocolVersion } from '../../types/security'
import type { RouteHandler, RoutingContext } from './types'
import { createActionCreators } from '../../core/actions/factory'
import { createProcessManager } from '../../core/processes/factory'
import { createRegistry } from '../../core/registry/factory'
import { createRouter } from './create-router'
import { routeEncryptedMessage } from './route-encrypted-message'

describe('routeEncryptedMessage', () => {
  const validContract: IChannelContract = {
    accepted: [{ type: 'test-message', description: 'Test message' }],
    emitted: [{ type: 'response-message', description: 'Response message' }],
  }

  const createMockBrokerState = (): BrokerState => ({
    id: 'broker-1',
    name: 'test-broker',
    window: <Window>global.window,
    contract: validContract,
    settings: {
      contract: validContract,
      logLevel: 'debug',
    },
  })

  let registry: ReturnType<typeof createRegistry>
  let processManager: ReturnType<typeof createProcessManager>
  let actions: ActionCreators
  let router: Map<string, RouteHandler>
  let mockLogger: Logger
  let routingContext: RoutingContext

  beforeEach(() => {
    registry = createRegistry()
    processManager = createProcessManager()
    actions = createActionCreators({
      getBrokerId: () => 'broker-1',
      getContract: () => validContract,
    })
    router = createRouter({})
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      setLogLevel: jest.fn(),
      getLogLevel: jest.fn(() => 'debug'),
    }
    routingContext = {
      state: createMockBrokerState(),
      registry,
      processManager,
      actions,
      logger: mockLogger,
    }
  })

  it('returns early when payload is not Uint8Array', () => {
    const event = <MessageEvent<Uint8Array>>(<unknown>{
      data: 'not-uint8array',
      origin: 'http://example.com',
    })

    routeEncryptedMessage(routingContext, router, event)

    expect(mockLogger.warn).toHaveBeenCalledWith('routeEncryptedMessage called with non-Uint8Array payload')
  })

  it('logs when no channel found for origin', () => {
    const payload = new Uint8Array([1, 2, 3])
    const event = <MessageEvent<Uint8Array>>{
      data: payload,
      origin: 'http://unknown.com',
    }

    routeEncryptedMessage(routingContext, router, event)

    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('ignored encrypted message - no channel for origin'))
  })

  it('warns when channel has no security transport', () => {
    const payload = new Uint8Array([1, 2, 3])

    const mockWindow = <Window>(<unknown>{ postMessage: jest.fn() })
    const mockChannel: Partial<ChannelHandle> = {
      id: 'channel-1',
      name: 'test-channel',
      target: mockWindow,
      isActive: () => true,
      getName: () => 'test-channel',
      getSecurityTransport: () => null,
      toJSON: () => ({
        id: 'channel-1',
        name: 'test-channel',
        active: true,
        origin: 'http://example.com',
        connectTimestamp: null,
        contract: null,
        queuedMessagesCount: 0,
      }),
    }

    registry.add(<ChannelHandle>mockChannel)

    const event = <MessageEvent<Uint8Array>>{
      data: payload,
      origin: 'http://example.com',
    }

    routeEncryptedMessage(routingContext, router, event)

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('received encrypted message but channel has no security transport')
    )
  })

  it('warns when security transport is not ready', () => {
    const payload = new Uint8Array([1, 2, 3])

    const mockTransport = {
      isReady: () => false,
      handleReceive: jest.fn(),
      getProtocol: (): SecurityProtocolVersion => 'v1',
      send: jest.fn(),
      onReceive: jest.fn(),
      stop: jest.fn(),
      resume: jest.fn(),
    }

    const mockWindow = <Window>(<unknown>{ postMessage: jest.fn() })
    const mockChannel: Partial<ChannelHandle> = {
      id: 'channel-1',
      name: 'test-channel',
      target: mockWindow,
      isActive: () => true,
      getName: () => 'test-channel',
      getSecurityTransport: () => mockTransport,
      toJSON: () => ({
        id: 'channel-1',
        name: 'test-channel',
        active: true,
        origin: 'http://example.com',
        connectTimestamp: null,
        contract: null,
        queuedMessagesCount: 0,
      }),
    }

    registry.add(<ChannelHandle>mockChannel)

    const event = <MessageEvent<Uint8Array>>{
      data: payload,
      origin: 'http://example.com',
    }

    routeEncryptedMessage(routingContext, router, event)

    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('received encrypted message but security transport not ready'))
    expect(mockTransport.handleReceive).not.toHaveBeenCalled()
  })

  it('errors when transport lacks handleReceive method', () => {
    const payload = new Uint8Array([1, 2, 3])

    const mockTransport = {
      isReady: () => true,
      getProtocol: (): SecurityProtocolVersion => 'v1',
      send: jest.fn(),
      onReceive: jest.fn(),
      stop: jest.fn(),
      resume: jest.fn(),
    }

    const mockWindow = <Window>(<unknown>{ postMessage: jest.fn() })
    const mockChannel: Partial<ChannelHandle> = {
      id: 'channel-1',
      name: 'test-channel',
      target: mockWindow,
      isActive: () => true,
      getName: () => 'test-channel',
      getSecurityTransport: () => mockTransport,
      toJSON: () => ({
        id: 'channel-1',
        name: 'test-channel',
        active: true,
        origin: 'http://example.com',
        connectTimestamp: null,
        contract: null,
        queuedMessagesCount: 0,
      }),
    }

    registry.add(<ChannelHandle>mockChannel)

    const event = <MessageEvent<Uint8Array>>{
      data: payload,
      origin: 'http://example.com',
    }

    routeEncryptedMessage(routingContext, router, event)

    expect(mockLogger.error).toHaveBeenCalledWith('Security transport missing handleReceive method')
  })

  it('routes encrypted message through transport when ready', () => {
    const payload = new Uint8Array([1, 2, 3])

    const mockTransport = {
      isReady: () => true,
      handleReceive: jest.fn(),
      getProtocol: (): SecurityProtocolVersion => 'v1',
      send: jest.fn(),
      onReceive: jest.fn(),
      stop: jest.fn(),
      resume: jest.fn(),
    }

    const mockWindow = <Window>(<unknown>{ postMessage: jest.fn() })
    const mockChannel: Partial<ChannelHandle> = {
      id: 'channel-1',
      name: 'test-channel',
      target: mockWindow,
      isActive: () => true,
      getName: () => 'test-channel',
      getSecurityTransport: () => mockTransport,
      toJSON: () => ({
        id: 'channel-1',
        name: 'test-channel',
        active: true,
        origin: 'http://example.com',
        connectTimestamp: null,
        contract: null,
        queuedMessagesCount: 0,
      }),
    }

    registry.add(<ChannelHandle>mockChannel)

    const event = <MessageEvent<Uint8Array>>{
      data: payload,
      origin: 'http://example.com',
    }

    routeEncryptedMessage(routingContext, router, event)

    expect(mockTransport.handleReceive).toHaveBeenCalledWith(payload)
  })

  it('handles transport errors and emits security-error event', () => {
    const payload = new Uint8Array([1, 2, 3])

    const mockTransport = {
      isReady: () => true,
      handleReceive: jest.fn().mockImplementation(() => {
        throw new Error('Decryption failed')
      }),
      getProtocol: (): SecurityProtocolVersion => 'v1',
      send: jest.fn(),
      onReceive: jest.fn(),
      stop: jest.fn(),
      resume: jest.fn(),
    }

    const notifyEventMock = jest.fn()

    const mockWindow = <Window>(<unknown>{ postMessage: jest.fn() })
    const mockChannel: Partial<ChannelHandle> = {
      id: 'channel-1',
      name: 'test-channel',
      target: mockWindow,
      isActive: () => true,
      getName: () => 'test-channel',
      getSecurityTransport: () => mockTransport,
      notifyEvent: notifyEventMock,
      toJSON: () => ({
        id: 'channel-1',
        name: 'test-channel',
        active: true,
        origin: 'http://example.com',
        connectTimestamp: null,
        contract: null,
        queuedMessagesCount: 0,
      }),
    }

    registry.add(<ChannelHandle>mockChannel)

    const event = <MessageEvent<Uint8Array>>{
      data: payload,
      origin: 'http://example.com',
    }

    routeEncryptedMessage(routingContext, router, event)

    expect(notifyEventMock).toHaveBeenCalledWith(
      'security-error',
      expect.objectContaining({
        message: 'Decryption failed',
        code: 'decryption_failed',
      })
    )
  })

  it('skips inactive channels when searching by origin', () => {
    const payload = new Uint8Array([1, 2, 3])

    const mockWindow = <Window>(<unknown>{ postMessage: jest.fn() })
    const inactiveChannel: Partial<ChannelHandle> = {
      id: 'channel-inactive',
      name: 'inactive-channel',
      target: mockWindow,
      isActive: () => false,
      getName: () => 'inactive-channel',
      getSecurityTransport: () => null,
      toJSON: () => ({
        id: 'channel-inactive',
        name: 'inactive-channel',
        active: false,
        origin: 'http://example.com',
        connectTimestamp: null,
        contract: null,
        queuedMessagesCount: 0,
      }),
    }

    registry.add(<ChannelHandle>inactiveChannel)

    const event = <MessageEvent<Uint8Array>>{
      data: payload,
      origin: 'http://example.com',
    }

    routeEncryptedMessage(routingContext, router, event)

    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('ignored encrypted message - no channel for origin'))
  })

  it('skips channels without isActive method', () => {
    const payload = new Uint8Array([1, 2, 3])

    const mockWindow = <Window>(<unknown>{ postMessage: jest.fn() })
    const badChannel = {
      id: 'channel-bad',
      name: 'bad-channel',
      target: mockWindow,
      getName: () => 'bad-channel',
      toJSON: () => ({
        id: 'channel-bad',
        name: 'bad-channel',
        active: true,
        origin: 'http://example.com',
        connectTimestamp: null,
        contract: null,
        queuedMessagesCount: 0,
      }),
    }

    registry.add(<ChannelHandle>(<unknown>badChannel))

    const event = <MessageEvent<Uint8Array>>{
      data: payload,
      origin: 'http://example.com',
    }

    routeEncryptedMessage(routingContext, router, event)

    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('ignored encrypted message - no channel for origin'))
  })

  it('handles security errors during decryption', () => {
    const payload = new Uint8Array([1, 2, 3])

    const mockTransport = {
      isReady: () => true,
      handleReceive: jest.fn(() => {
        throw new Error('Decryption failed')
      }),
      getProtocol: (): SecurityProtocolVersion => 'v1',
      send: jest.fn(),
      onReceive: jest.fn(),
      stop: jest.fn(),
      resume: jest.fn(),
    }

    const mockWindow = <Window>(<unknown>{ postMessage: jest.fn() })
    const mockNotifyEvent = jest.fn()
    const mockChannel: Partial<ChannelHandle> = {
      id: 'channel-1',
      name: 'test-channel',
      target: mockWindow,
      isActive: () => true,
      getName: () => 'test-channel',
      getSecurityTransport: () => mockTransport,
      notifyEvent: mockNotifyEvent,
      toJSON: () => ({
        id: 'channel-1',
        name: 'test-channel',
        active: true,
        origin: 'http://example.com',
        connectTimestamp: null,
        contract: null,
        queuedMessagesCount: 0,
      }),
    }

    registry.add(<ChannelHandle>mockChannel)

    const event = <MessageEvent<Uint8Array>>{
      data: payload,
      origin: 'http://example.com',
    }

    routeEncryptedMessage(routingContext, router, event)

    expect(mockTransport.handleReceive).toHaveBeenCalledWith(payload)
    expect(mockNotifyEvent).toHaveBeenCalledWith('security-error', expect.any(Object))
  })
})
