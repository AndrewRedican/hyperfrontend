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
    logger: {} as Logger,
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
    } as unknown as Logger
    routingContext = {
      state: createMockBrokerState(),
      registry,
      processManager,
      actions,
      logger: mockLogger,
      getSupportedProtocols: () => ['none'],
      security: { localId: 'broker-1', getProvider: () => undefined, dispatch: () => undefined },
    }
    sourceWindow = { postMessage: jest.fn() } as unknown as Window
  })

  function createMockTransport(overrides: Partial<SecurityTransport> = {}): SecurityTransport {
    return {
      send: jest.fn(),
      receive: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      resume: jest.fn(),
      dispose: jest.fn(),
      getProtocol: (): SecurityProtocolVersion => 'v4',
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

  function throwingTransport(error: unknown): SecurityTransport {
    return createMockTransport({
      receive: jest.fn(() => {
        throw error
      }),
    })
  }

  function codedError(message: string, code: string): Error {
    const error = new Error(message) as Error & { code: string }
    error.code = code
    return error
  }

  describe('resolving the channel', () => {
    it('warns when the payload is not a Uint8Array', () => {
      routeEncryptedMessage(routingContext, router, encryptedEvent({ data: 'not-uint8array' }))

      expect(mockLogger.warn).toHaveBeenCalledWith('routeEncryptedMessage called with non-Uint8Array payload')
    })

    it('drops the frame when the event has no source window', () => {
      routeEncryptedMessage(routingContext, router, encryptedEvent({ source: null }))

      expect(mockLogger.info).toHaveBeenCalledWith('test-broker ignored a wire frame - no channel for the source window')
    })

    it('drops the frame when no channel is registered for the source window', () => {
      routeEncryptedMessage(routingContext, router, encryptedEvent())

      expect(mockLogger.info).toHaveBeenCalledWith('test-broker ignored a wire frame - no channel for the source window')
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
  })

  describe('enforcing the pinned origin', () => {
    it('drops frames whose origin does not match the pinned origin', () => {
      const notifyEvent = jest.fn()
      const transport = createMockTransport()
      addMockChannel({ transport, notifyEvent })

      routeEncryptedMessage(routingContext, router, encryptedEvent({ origin: 'http://evil.example' }))

      expect({ received: (transport.receive as Mock).mock.calls, invalid: notifyEvent.mock.calls }).toEqual({
        received: [],
        invalid: [['invalid', { error: "Dropped a wire frame from unexpected origin 'http://evil.example'." }]],
      })
    })

    it('accepts frames from any origin while the channel is unpinned', () => {
      const transport = createMockTransport()
      addMockChannel({ transport, origin: null })

      routeEncryptedMessage(routingContext, router, encryptedEvent({ origin: 'http://anywhere.example' }))

      expect(transport.receive).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]))
    })

    it('accepts frames from any origin while the channel is pinned to the wildcard', () => {
      const transport = createMockTransport()
      addMockChannel({ transport, origin: '*' })

      routeEncryptedMessage(routingContext, router, encryptedEvent({ origin: 'http://anywhere.example' }))

      expect(transport.receive).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]))
    })
  })

  describe('handing the frame to the transport', () => {
    it('warns when the channel has no security transport', () => {
      addMockChannel({ transport: null })

      routeEncryptedMessage(routingContext, router, encryptedEvent())

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'test-broker received a wire frame but the test-channel channel has no security transport'
      )
    })

    it('feeds the frame to the channel transport', () => {
      const transport = createMockTransport()
      addMockChannel({ transport })

      routeEncryptedMessage(routingContext, router, encryptedEvent())

      expect(transport.receive).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]))
    })

    it('feeds the frame to the transport without starting it', () => {
      const transport = createMockTransport()
      addMockChannel({ transport })

      routeEncryptedMessage(routingContext, router, encryptedEvent())

      expect(transport.start).not.toHaveBeenCalled()
    })
  })

  describe('transport failures', () => {
    it('fires a security-error event with the unknown code when the transport throws a plain error', () => {
      const notifyEvent = jest.fn()
      const error = new Error('Decryption failed')
      addMockChannel({ transport: throwingTransport(error), notifyEvent })

      routeEncryptedMessage(routingContext, router, encryptedEvent())

      expect(notifyEvent).toHaveBeenCalledWith('security-error', { message: 'Decryption failed', code: 'unknown', cause: error })
    })

    it('logs a plain error through the error level', () => {
      const error = new Error('Decryption failed')
      addMockChannel({ transport: throwingTransport(error) })

      routeEncryptedMessage(routingContext, router, encryptedEvent())

      expect(mockLogger.error).toHaveBeenCalledWith('test-channel security error:', 'Decryption failed', error)
    })

    it('keeps the wire protocol code of an error the transport throws', () => {
      const notifyEvent = jest.fn()
      const error = codedError('Frame counter is stale', 'replayed')
      addMockChannel({ transport: throwingTransport(error), notifyEvent })

      routeEncryptedMessage(routingContext, router, encryptedEvent())

      expect(notifyEvent).toHaveBeenCalledWith('security-error', { message: 'Frame counter is stale', code: 'replayed', cause: error })
    })

    it('logs a coded error through the warn level', () => {
      addMockChannel({ transport: throwingTransport(codedError('Frame counter is stale', 'replayed')) })

      routeEncryptedMessage(routingContext, router, encryptedEvent())

      expect(mockLogger.warn).toHaveBeenCalledWith('test-channel security error:', '[replayed]', 'Frame counter is stale')
    })

    it('reports a thrown non-error as an unknown failure without a cause', () => {
      const notifyEvent = jest.fn()
      addMockChannel({ transport: throwingTransport('pipeline exploded'), notifyEvent })

      routeEncryptedMessage(routingContext, router, encryptedEvent())

      expect(notifyEvent).toHaveBeenCalledWith('security-error', { message: 'pipeline exploded', code: 'unknown' })
    })
  })
})
