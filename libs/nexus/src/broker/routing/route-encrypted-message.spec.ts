import type { Logger } from '@hyperfrontend/logging'
import type { Mock } from '@hyperfrontend/testing'
import type { BrokerState } from '../../broker/types'
import type { ActionCreators } from '../../core/actions/factory'
import type { ChannelHandle } from '../../types/channel'
import type { IChannelContract } from '../../types/contract'
import type { SecurityProtocolVersion, SecurityTransport } from '../../types/security'
import type { RouteHandler, RoutingContext } from './types'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
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
    window: global.window as Window,
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
  let sourceWindow: Window

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
      getSupportedProtocols: () => ['none'],
      getProtocol: () => undefined,
      routeAction: () => undefined,
    }
    sourceWindow = { postMessage: jest.fn() } as unknown as Window
  })

  function createMockTransport(overrides: Partial<SecurityTransport> = {}): SecurityTransport {
    return {
      isReady: () => true,
      receive: jest.fn(),
      getProtocol: (): SecurityProtocolVersion => 'v1',
      send: jest.fn(),
      stop: jest.fn(),
      resume: jest.fn(),
      ...overrides,
    }
  }

  function addMockChannel(
    overrides: Partial<{ origin: string | null; transport: SecurityTransport | null; notifyEvent: Mock }> = {}
  ): Partial<ChannelHandle> {
    const mockChannel: Partial<ChannelHandle> = {
      id: 'channel-1',
      name: 'test-channel',
      target: sourceWindow,
      isActive: () => true,
      getName: () => 'test-channel',
      getOrigin: () => ('origin' in overrides ? (overrides.origin as string | null) : 'http://example.com'),
      getSecurityTransport: () => ('transport' in overrides ? (overrides.transport as SecurityTransport | null) : null),
      notifyEvent: overrides.notifyEvent ?? jest.fn(),
    }
    registry.add(mockChannel as ChannelHandle)
    return mockChannel
  }

  function encryptedEvent(overrides: Partial<{ data: unknown; origin: string; source: Window | null }> = {}) {
    return {
      data: 'data' in overrides ? overrides.data : new Uint8Array([1, 2, 3]),
      origin: overrides.origin ?? 'http://example.com',
      source: 'source' in overrides ? overrides.source : sourceWindow,
    } as unknown as MessageEvent<Uint8Array>
  }

  it('returns early when payload is not Uint8Array', () => {
    routeEncryptedMessage(routingContext, router, encryptedEvent({ data: 'not-uint8array' }))

    expect(mockLogger.warn).toHaveBeenCalledWith('routeEncryptedMessage called with non-Uint8Array payload')
  })

  it('drops the payload when the event has no source window', () => {
    routeEncryptedMessage(routingContext, router, encryptedEvent({ source: null }))

    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('ignored encrypted message - no channel for the source window'))
  })

  it('drops the payload when no channel is registered for the source window', () => {
    routeEncryptedMessage(routingContext, router, encryptedEvent())

    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('ignored encrypted message - no channel for the source window'))
  })

  it('resolves the channel by source window even when another channel shares the origin', () => {
    addMockChannel({ transport: null })
    const otherWindow = { postMessage: jest.fn() } as unknown as Window
    const transport = createMockTransport()
    const otherChannel: Partial<ChannelHandle> = {
      id: 'channel-2',
      name: 'other-channel',
      target: otherWindow,
      isActive: () => true,
      getName: () => 'other-channel',
      getOrigin: () => 'http://example.com',
      getSecurityTransport: () => transport,
      notifyEvent: jest.fn(),
    }
    registry.add(otherChannel as ChannelHandle)

    routeEncryptedMessage(routingContext, router, encryptedEvent({ source: otherWindow }))

    expect(transport.receive).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]))
  })

  it('drops payloads whose origin does not match the pinned origin', () => {
    const notifyEvent = jest.fn()
    const transport = createMockTransport()
    addMockChannel({ transport, notifyEvent })

    routeEncryptedMessage(routingContext, router, encryptedEvent({ origin: 'http://evil.example' }))

    expect({ received: (transport.receive as Mock).mock.calls, invalid: notifyEvent.mock.calls }).toEqual({
      received: [],
      invalid: [['invalid', { error: "Dropped encrypted message from unexpected origin 'http://evil.example'." }]],
    })
  })

  it('accepts payloads from any origin while the channel is unpinned', () => {
    const transport = createMockTransport()
    addMockChannel({ transport, origin: null })

    routeEncryptedMessage(routingContext, router, encryptedEvent({ origin: 'http://anywhere.example' }))

    expect(transport.receive).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]))
  })

  it('warns when channel has no security transport', () => {
    addMockChannel({ transport: null })

    routeEncryptedMessage(routingContext, router, encryptedEvent())

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('received encrypted message but channel has no security transport')
    )
  })

  it('warns when security transport is not ready', () => {
    const transport = createMockTransport({ isReady: () => false })
    addMockChannel({ transport })

    routeEncryptedMessage(routingContext, router, encryptedEvent())

    expect({ warns: (mockLogger.warn as Mock).mock.calls, received: (transport.receive as Mock).mock.calls }).toEqual({
      warns: [[expect.stringContaining('received encrypted message but security transport not ready')]],
      received: [],
    })
  })

  it('routes encrypted message through transport when ready', () => {
    const transport = createMockTransport()
    addMockChannel({ transport })

    routeEncryptedMessage(routingContext, router, encryptedEvent())

    expect(transport.receive).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]))
  })

  it('handles transport errors and emits security-error event', () => {
    const notifyEvent = jest.fn()
    const transport = createMockTransport({
      receive: jest.fn(() => {
        throw new Error('Decryption failed')
      }),
    })
    addMockChannel({ transport, notifyEvent })

    routeEncryptedMessage(routingContext, router, encryptedEvent())

    expect(notifyEvent).toHaveBeenCalledWith(
      'security-error',
      expect.objectContaining({
        message: 'Decryption failed',
        code: 'decryption_failed',
      })
    )
  })
})
