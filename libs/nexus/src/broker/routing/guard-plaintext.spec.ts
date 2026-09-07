import type { Logger } from '@hyperfrontend/logging'
import type { Mock } from '@hyperfrontend/testing'
import type { IAction } from '../../types/action'
import type { ChannelHandle } from '../../types/channel'
import type { IChannelContract } from '../../types/contract'
import type { SecurityTransport } from '../../types/security'
import type { BrokerState } from '../types'
import type { RoutingContext } from './types'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { HANDSHAKE_ACTION_TYPES } from '../../constants/handshake-actions'
import { createActionCreators } from '../../core/actions/factory'
import { createProcessManager } from '../../core/processes/factory'
import { createRegistry } from '../../core/registry/factory'
import { ACTION_TYPES } from '../../types/action'
import { isPlaintextAllowed } from './guard-plaintext'

describe('isPlaintextAllowed', () => {
  const contract: IChannelContract = {
    accepted: [{ type: 'test-message', description: 'Test message' }],
    emitted: [{ type: 'response-message', description: 'Response message' }],
  }

  const brokerState: BrokerState = {
    id: 'broker-1',
    name: 'test-broker',
    window: {} as Window,
    contract,
    settings: { contract },
    logger: {} as Logger,
  }

  let registry: ReturnType<typeof createRegistry>
  let logger: Logger
  let context: RoutingContext
  let sourceWindow: Window
  let transport: SecurityTransport

  beforeEach(() => {
    registry = createRegistry()
    logger = {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      setLogLevel: jest.fn(),
      getLogLevel: jest.fn(() => 'debug'),
    } as unknown as Logger
    context = {
      state: brokerState,
      registry,
      processManager: createProcessManager(),
      actions: createActionCreators({ getBrokerId: () => 'broker-1', getContract: () => contract }),
      logger,
      getSupportedProtocols: () => ['none'],
      security: { localId: 'broker-1', getProvider: () => undefined, dispatch: () => undefined },
    }
    sourceWindow = { postMessage: jest.fn() } as unknown as Window
    transport = {
      send: jest.fn(),
      receive: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      resume: jest.fn(),
      dispose: jest.fn(),
      getProtocol: () => 'v4',
    }
  })

  function addChannel(securityTransport: SecurityTransport | null, target: Window = sourceWindow): Partial<ChannelHandle> {
    const channel: Partial<ChannelHandle> = {
      id: 'channel-1',
      name: 'test-channel',
      target,
      getName: () => 'test-channel',
      getSecurityTransport: () => securityTransport,
      notifyEvent: jest.fn(),
    }
    registry.add(channel as ChannelHandle)
    return channel
  }

  function event(data: unknown, source: Window | null = sourceWindow): MessageEvent<IAction> {
    return { data, source, origin: 'https://example.com' } as unknown as MessageEvent<IAction>
  }

  const newMessage: IAction = { type: ACTION_TYPES.NEW_MESSAGE, senderId: 'remote-broker-1', data: { type: 'test-message' } }

  describe('actions that never need the gate', () => {
    it('admits an event that carries no action', () => {
      addChannel(transport)

      expect(isPlaintextAllowed(context, event(null))).toBe(true)
    })

    it('admits an action whose type is not a string', () => {
      addChannel(transport)

      expect(isPlaintextAllowed(context, event({ type: 42, senderId: 'remote-broker-1' }))).toBe(true)
    })

    it('admits a missing event', () => {
      expect(isPlaintextAllowed(context, undefined as unknown as MessageEvent<IAction>)).toBe(true)
    })

    it('names the six handshake actions as the plaintext set', () => {
      expect([...HANDSHAKE_ACTION_TYPES]).toEqual([
        ACTION_TYPES.REQUEST_CONNECTION,
        ACTION_TYPES.ACCEPT_CONNECTION,
        ACTION_TYPES.DENY_CONNECTION,
        ACTION_TYPES.CANCEL_CONNECTION,
        ACTION_TYPES.CANCEL_CONNECTION_ACKNOWLEDGED,
        ACTION_TYPES.OPEN_CONNECTION,
      ])
    })

    it('admits every handshake action on a secured channel', () => {
      addChannel(transport)

      const verdicts = [...HANDSHAKE_ACTION_TYPES].map((type) => [
        type,
        isPlaintextAllowed(context, event({ type, senderId: 'remote-broker-1', processId: 'process-1' })),
      ])

      expect(verdicts).toEqual([...HANDSHAKE_ACTION_TYPES].map((type) => [type, true]))
    })

    it('keeps quiet while admitting handshake actions on a secured channel', () => {
      const channel = addChannel(transport)

      for (const type of HANDSHAKE_ACTION_TYPES) {
        isPlaintextAllowed(context, event({ type, senderId: 'remote-broker-1', processId: 'process-1' }))
      }

      expect({ warned: (logger.warn as Mock).mock.calls, notified: (channel.notifyEvent as Mock).mock.calls }).toEqual({
        warned: [],
        notified: [],
      })
    })
  })

  describe('windows the gate cannot secure', () => {
    it('admits an action from an event without a source window', () => {
      addChannel(transport)

      expect(isPlaintextAllowed(context, event(newMessage, null))).toBe(true)
    })

    it('admits an action from a window without a channel', () => {
      addChannel(transport, { postMessage: jest.fn() } as unknown as Window)

      expect(isPlaintextAllowed(context, event(newMessage))).toBe(true)
    })

    it('admits an action for a channel without a transport', () => {
      addChannel(null)

      expect(isPlaintextAllowed(context, event(newMessage))).toBe(true)
    })

    it('fires nothing while admitting an unsecured channel', () => {
      const channel = addChannel(null)

      isPlaintextAllowed(context, event(newMessage))

      expect({ warned: (logger.warn as Mock).mock.calls, notified: (channel.notifyEvent as Mock).mock.calls }).toEqual({
        warned: [],
        notified: [],
      })
    })
  })

  describe('secured channels', () => {
    it('drops a plaintext action for a channel with a transport', () => {
      addChannel(transport)

      expect(isPlaintextAllowed(context, event(newMessage))).toBe(false)
    })

    it('warns with the broker, action, and channel names', () => {
      addChannel(transport)

      isPlaintextAllowed(context, event(newMessage))

      expect(logger.warn).toHaveBeenCalledWith(
        "test-broker dropped a plaintext '[nexus] new-message' action: the test-channel channel is secured."
      )
    })

    it('fires an invalid event carrying the dropped action', () => {
      const channel = addChannel(transport)

      isPlaintextAllowed(context, event(newMessage))

      expect(channel.notifyEvent).toHaveBeenCalledWith('invalid', {
        error: "Dropped plaintext '[nexus] new-message' action: the channel is secured.",
        action: newMessage,
      })
    })

    it('drops a plaintext close, which is not a handshake action', () => {
      addChannel(transport)

      const close: IAction = { type: ACTION_TYPES.CLOSE_CONNECTION, senderId: 'remote-broker-1', processId: 'process-1' }

      expect(isPlaintextAllowed(context, event(close))).toBe(false)
    })

    it('resolves the channel by the source window, not by the sender id', () => {
      addChannel(transport, { postMessage: jest.fn() } as unknown as Window)
      const unsecured: Partial<ChannelHandle> = {
        id: 'channel-2',
        name: 'other-channel',
        target: sourceWindow,
        getName: () => 'other-channel',
        getSecurityTransport: () => null,
        notifyEvent: jest.fn(),
      }
      registry.add(unsecured as ChannelHandle)

      expect(isPlaintextAllowed(context, event({ ...newMessage, senderId: 'channel-1' }))).toBe(true)
    })
  })
})
