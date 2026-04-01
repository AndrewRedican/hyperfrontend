import type { Logger } from '@hyperfrontend/logging'
import type { IAction } from '../../types/action'
import type { IChannelContract } from '../../types/contract'
import type { BrokerState } from '../types'
import type { RoutingContext } from './types'
import { createActionCreators } from '../../core/actions/factory'
import { createProcessManager } from '../../core/processes/factory'
import { createRegistry } from '../../core/registry/factory'
import { addChannel } from '../channels/add'
import { handleOpen } from './handle-open'

describe('handleOpen', () => {
  const validContract: IChannelContract = {
    accepted: [{ type: 'test-message', description: 'Test message' }],
    emitted: [{ type: 'response-message', description: 'Response message' }],
  }

  let mockLogger: Logger
  let mockBrokerState: BrokerState

  let registry: ReturnType<typeof createRegistry>
  let processManager: ReturnType<typeof createProcessManager>
  let actions: ReturnType<typeof createActionCreators>
  let mockWindow: Window
  let routingContext: RoutingContext

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
      contract: validContract,
      settings: {
        contract: validContract,
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
    }
  })

  it('process open for existing channel', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    const action: IAction = {
      type: '[nexus] connection-opened',
      processId,
      senderId: 'remote-broker-1',
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      origin: 'http://example.com',
      source: mockWindow,
    }

    expect(() => {
      handleOpen(routingContext, message)
    }).not.toThrow()

    expect(processManager.get(processId)).toBeUndefined()
  })

  it('ignore if channel not found', () => {
    const action: IAction = {
      type: '[nexus] connection-opened',
      processId: 'non-existent-process',
      senderId: 'remote-broker-1',
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      origin: 'http://example.com',
      source: mockWindow,
    }

    expect(() => {
      handleOpen(routingContext, message)
    }).not.toThrow()
  })

  it('calls notifyEvent when channel has the method', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    const notifyEventMock = jest.fn()
    Object.defineProperty(channel, 'notifyEvent', {
      value: notifyEventMock,
      writable: true,
    })

    const action: IAction = {
      type: '[nexus] connection-opened',
      processId,
      senderId: 'remote-broker-1',
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      origin: 'http://example.com',
      source: mockWindow,
    }

    handleOpen(routingContext, message)

    expect(notifyEventMock).toHaveBeenCalledWith('open', { origin: 'http://example.com' })
  })

  it('handles security confirmation and sets protocol', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    const setNegotiatedProtocolMock = jest.fn()
    const setSecurityReadyMock = jest.fn()
    const notifyEventMock = jest.fn()
    const getNegotiatedProtocolMock = jest.fn().mockReturnValue(null)
    Object.defineProperty(channel, 'setNegotiatedProtocol', { value: setNegotiatedProtocolMock, writable: true })
    Object.defineProperty(channel, 'setSecurityReady', { value: setSecurityReadyMock, writable: true })
    Object.defineProperty(channel, 'notifyEvent', { value: notifyEventMock, writable: true })
    Object.defineProperty(channel, 'getNegotiatedProtocol', { value: getNegotiatedProtocolMock, writable: true })

    const action: IAction = {
      type: '[nexus] connection-opened',
      processId,
      senderId: 'remote-broker-1',
      security: { protocol: 'v1', active: true },
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      origin: 'http://example.com',
      source: mockWindow,
    }

    handleOpen(routingContext, message)

    expect(setNegotiatedProtocolMock).toHaveBeenCalledWith('v1')
    expect(setSecurityReadyMock).toHaveBeenCalledWith(true)
    expect(notifyEventMock).toHaveBeenCalledWith('security-ready', { protocol: 'v1', active: true })
    expect(notifyEventMock).toHaveBeenCalledWith('open', { origin: 'http://example.com' })
  })

  it('skips setting protocol if already negotiated', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    const setNegotiatedProtocolMock = jest.fn()
    const getNegotiatedProtocolMock = jest.fn().mockReturnValue('v1')
    const notifyEventMock = jest.fn()
    Object.defineProperty(channel, 'setNegotiatedProtocol', { value: setNegotiatedProtocolMock, writable: true })
    Object.defineProperty(channel, 'getNegotiatedProtocol', { value: getNegotiatedProtocolMock, writable: true })
    Object.defineProperty(channel, 'notifyEvent', { value: notifyEventMock, writable: true })
    Object.defineProperty(channel, 'setSecurityReady', { value: jest.fn(), writable: true })

    const action: IAction = {
      type: '[nexus] connection-opened',
      processId,
      senderId: 'remote-broker-1',
      security: { protocol: 'v1', active: true },
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      origin: 'http://example.com',
      source: mockWindow,
    }

    handleOpen(routingContext, message)

    expect(setNegotiatedProtocolMock).not.toHaveBeenCalled()
  })

  it('logs debug info when security is ready', () => {
    const debugState: BrokerState = {
      ...mockBrokerState,
      settings: { ...mockBrokerState.settings, logLevel: 'debug' },
    }

    const debugContext: RoutingContext = {
      ...routingContext,
      state: debugState,
    }

    const channel = addChannel(debugState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    Object.defineProperty(channel, 'getNegotiatedProtocol', { value: () => null, writable: true })
    Object.defineProperty(channel, 'setNegotiatedProtocol', { value: jest.fn(), writable: true })
    Object.defineProperty(channel, 'setSecurityReady', { value: jest.fn(), writable: true })
    Object.defineProperty(channel, 'notifyEvent', { value: jest.fn(), writable: true })

    const action: IAction = {
      type: '[nexus] connection-opened',
      processId,
      senderId: 'remote-broker-1',
      security: { protocol: 'v2', active: true },
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      origin: 'http://example.com',
      source: mockWindow,
    }

    handleOpen(debugContext, message)

    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('security ready'))
  })

  it('marks security ready for no security confirmation', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    const setSecurityReadyMock = jest.fn()
    const notifyEventMock = jest.fn()
    Object.defineProperty(channel, 'setSecurityReady', { value: setSecurityReadyMock, writable: true })
    Object.defineProperty(channel, 'notifyEvent', { value: notifyEventMock, writable: true })

    const action: IAction = {
      type: '[nexus] connection-opened',
      processId,
      senderId: 'remote-broker-1',
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      origin: 'http://example.com',
      source: mockWindow,
    }

    handleOpen(routingContext, message)

    expect(setSecurityReadyMock).toHaveBeenCalledWith(true)
  })

  it('handles multiple open events for different channels', () => {
    const channel1 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-1', mockWindow)
    const processId1 = processManager.create(channel1)

    const window2 = <Window>(<unknown>{
      postMessage: jest.fn(),
      _uniqueId: 'window-2',
    })
    const channel2 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-2', window2)
    const processId2 = processManager.create(channel2)

    const action1: IAction = {
      type: '[nexus] connection-opened',
      processId: processId1,
      senderId: 'remote-1',
    }

    const action2: IAction = {
      type: '[nexus] connection-opened',
      processId: processId2,
      senderId: 'remote-2',
    }

    handleOpen(routingContext, <MessageEvent<IAction>>{
      data: action1,
      origin: 'http://example1.com',
      source: mockWindow,
    })

    handleOpen(routingContext, <MessageEvent<IAction>>{
      data: action2,
      origin: 'http://example2.com',
      source: window2,
    })

    expect(processManager.get(processId1)).toBeUndefined()
    expect(processManager.get(processId2)).toBeUndefined()
  })
})
