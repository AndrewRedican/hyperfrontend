import type { Mock } from '@hyperfrontend/testing'
import type { IAction } from '../types/action'
import type { IChannelConfig } from '../types/channel'
import type { SecurityProvider, SecurityTransport, SecurityWireChannel } from '../types/security'
import type { ChannelDependencies, ChannelSecurityDependencies } from './types'
import { beforeEach } from 'node:test'
import { hasOwn } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createChannel } from './factory'

describe('channel/factory', () => {
  let config: IChannelConfig
  let deps: ChannelDependencies
  let createdProcesses: string[]
  let provider: SecurityProvider
  let security: ChannelSecurityDependencies

  const createMockTransport = (): SecurityTransport => ({
    send: jest.fn(),
    receive: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    resume: jest.fn(),
    dispose: jest.fn(),
    getProtocol: jest.fn(() => 'v4'),
  })

  const createWireChannel = (label: string): SecurityWireChannel => ({
    label,
    send: jest.fn(),
    receive: jest.fn(),
    stop: jest.fn(),
    resume: jest.fn(),
    hello: jest.fn(async () => new Uint8Array([1])),
    isHello: jest.fn(() => false),
    acceptHello: jest.fn(() => 'accepted'),
  })

  beforeEach(() => {
    createdProcesses = []

    config = {
      name: 'test-channel',
      target: window,
    }

    provider = { createChannel: jest.fn((label: string) => createWireChannel(label)), protocolProvider: jest.fn() }
    security = { localId: 'local-1', getProvider: jest.fn(() => provider), dispatch: jest.fn() }

    deps = {
      actions: {
        requestConnection: jest.fn((processId) => ({
          type: '[nexus] connection-request',
          processId,
          senderId: 'test-broker-id',
          contract: { accepted: [], emitted: [] },
        })),
        acceptConnection: jest.fn((processId) => ({
          type: '[nexus] connection-request-accepted',
          processId,
          senderId: 'test-broker-id',
          contract: { accepted: [], emitted: [] },
        })),
        denyConnection: jest.fn((processId, reason) => ({
          type: '[nexus] connection-request-denied',
          processId,
          senderId: 'test-broker-id',
          error: reason,
        })),
        cancelConnection: jest.fn((processId) => ({
          type: '[nexus] connection-request-cancelled',
          processId,
          senderId: 'test-broker-id',
        })),
        openConnection: jest.fn((processId) => ({
          type: '[nexus] connection-opened',
          processId,
          senderId: 'test-broker-id',
        })),
        closeConnection: jest.fn((processId) => ({
          type: '[nexus] connection-closed',
          processId,
          senderId: 'test-broker-id',
        })),
        destroyConnection: jest.fn(() => ({
          type: '[nexus] connection-destroyed',
          senderId: 'test-broker-id',
        })),
        newMessage: jest.fn((data) => ({
          type: '[nexus] new-message',
          senderId: 'test-broker-id',
          data,
        })),
        invalidRequest: jest.fn((processId, error) => ({
          type: '[nexus] invalid-request',
          processId,
          senderId: 'test-broker-id',
          error,
        })),
      },
      processManager: {
        create: jest.fn(() => {
          const processId = `process-${createdProcesses.length + 1}`
          createdProcesses.push(processId)
          return processId
        }),
        remove: jest.fn((processId) => {
          const index = createdProcesses.indexOf(processId)
          if (index !== -1) {
            createdProcesses.splice(index, 1)
          }
        }),
      },
      cleanup: jest.fn(),
    }

    window.postMessage = jest.fn()
  })

  describe('createChannel', () => {
    it('creates a channel with a uuid, its name, and its target', () => {
      const channel = createChannel(config, deps)

      expect({ id: channel.getId(), name: channel.getName(), target: channel.getTarget(), active: channel.isActive() }).toEqual({
        id: expect.stringMatching(/^[a-f0-9-]{36}$/),
        name: 'test-channel',
        target: window,
        active: false,
      })
    })

    it('creates a channel with default settings', () => {
      const channel = createChannel(config, deps)

      expect(channel.toJSON()).toEqual(
        expect.objectContaining({ active: false, origin: null, connectTimestamp: null, contract: null, queuedMessagesCount: 0 })
      )
    })

    it('pins a concrete origin from the settings', () => {
      const channel = createChannel({ ...config, settings: { origin: 'https://example.com', queueMessages: false } }, deps)

      expect(channel.getOrigin()).toBe('https://example.com')
    })

    it('exposes lifecycle, messaging, and subscription methods', () => {
      const channel = createChannel(config, deps)

      const methods = [
        channel.connect,
        channel.disconnect,
        channel.cancel,
        channel.destroy,
        channel.send,
        channel.sendAction,
        channel.on,
        channel.onMessage,
      ]

      expect(methods).toEqual(methods.map(() => expect.any(Function)))
    })
  })

  describe('integration: lifecycle', () => {
    it('connect sends a connection request through a tracked process', () => {
      const channel = createChannel(config, deps)

      channel.connect()

      expect(deps.actions.requestConnection).toHaveBeenCalledWith('process-1', undefined)
    })

    it('disconnect does nothing while the handshake is pending', () => {
      const channel = createChannel(config, deps)
      channel.connect()

      channel.disconnect()

      expect(deps.actions.closeConnection).not.toHaveBeenCalled()
    })

    it('endStaleSession closes an active channel with reason peer-reload', () => {
      const channel = createChannel(config, deps)
      const handler = jest.fn()
      channel.activate('https://example.com', { accepted: [], emitted: [] }, 'peer-1')
      channel.on('close', handler)

      channel.endStaleSession()

      expect(handler).toHaveBeenCalledWith({ notify: false, reason: 'peer-reload' }, expect.objectContaining({ active: false }))
    })
  })

  describe('integration: messaging', () => {
    it('queues messages when the channel is inactive', () => {
      const channel = createChannel(config, deps)

      channel.send('test-type', { foo: 'bar' })

      expect(channel.toJSON().queuedMessagesCount).toBe(1)
    })

    it('sends through the attached transport as soon as the channel is active', () => {
      const transport = createMockTransport()
      const channel = createChannel({ ...config, settings: { contract: { accepted: [], emitted: [{ type: 'msg1' }] } } }, deps)
      channel.activate('https://example.com', { accepted: [{ type: 'msg1' }], emitted: [] }, 'peer-1')
      channel.setSecurityTransport(transport)

      channel.send('msg1', { seq: 1 })

      expect(transport.send).toHaveBeenCalledWith(
        expect.objectContaining({ type: '[nexus] new-message', data: expect.objectContaining({ data: { seq: 1 } }) })
      )
    })

    it('sends a payload-less message without a data key so envelope serializability validation passes', () => {
      const transport = createMockTransport()
      const channel = createChannel({ ...config, settings: { contract: { accepted: [], emitted: [{ type: 'msg1' }] } } }, deps)
      channel.activate('https://example.com', { accepted: [{ type: 'msg1' }], emitted: [] }, 'peer-1')
      channel.setSecurityTransport(transport)

      channel.send('msg1')

      const sent = (transport.send as Mock).mock.calls[0][0] as { data: object }
      expect({ sent, hasDataKey: hasOwn(sent.data, 'data') }).toEqual({
        sent: { type: '[nexus] new-message', senderId: 'test-broker-id', data: { type: 'msg1' } },
        hasDataKey: false,
      })
    })
  })

  describe('broker-internal methods', () => {
    it('isReadyToConnect returns false by default', () => {
      const channel = createChannel(config, deps)

      expect(channel.isReadyToConnect()).toBe(false)
    })

    it('isReadyToConnect returns true after connect() is called', () => {
      const channel = createChannel(config, deps)

      channel.connect()

      expect(channel.isReadyToConnect()).toBe(true)
    })

    it('isReadyToConnect returns false for broker-managed channels before connect() is called', () => {
      const channel = createChannel({ ...config, settings: { brokerManaged: true } }, deps)

      expect(channel.isReadyToConnect()).toBe(false)
    })

    it('registers the channel handle with the process manager', () => {
      const channel = createChannel(config, deps)

      channel.connect()

      expect(deps.processManager.create).toHaveBeenCalledWith(channel)
    })

    it('activate updates channel state', () => {
      const channel = createChannel(config, deps)

      channel.activate('https://example.com', { accepted: [{ type: 'msg1' }], emitted: [] })

      expect(channel.isActive()).toBe(true)
    })

    it('getAcceptedTypes returns an empty list before activation', () => {
      const channel = createChannel(config, deps)

      expect(channel.getAcceptedTypes()).toEqual([])
    })

    it('getAcceptedTypes returns the own accepted types after activation', () => {
      const channel = createChannel(
        { ...config, settings: { contract: { accepted: [{ type: 'msg1' }, { type: 'msg2' }], emitted: [] } } },
        deps
      )

      channel.activate('https://example.com', { accepted: [{ type: 'other' }], emitted: [] }, 'peer-1')

      expect(channel.getAcceptedTypes()).toEqual(['msg1', 'msg2'])
    })

    it('markDenyNotified records the first denial of a process', () => {
      const channel = createChannel(config, deps)

      expect(channel.markDenyNotified('process-1')).toBe(true)
    })

    it('markDenyNotified rejects a repeated denial of the same process', () => {
      const channel = createChannel(config, deps)
      channel.markDenyNotified('process-1')

      expect(channel.markDenyNotified('process-1')).toBe(false)
    })
  })

  describe('isAwaitingOpen', () => {
    const contract = { accepted: [{ type: 'test' }], emitted: [] }
    const acceptAction: IAction = { type: '[nexus] connection-request-accepted', senderId: 'test-broker-id' }

    it('reports the window between ACCEPT and OPEN', () => {
      const channel = createChannel(config, deps)
      const awaitingBefore = channel.isAwaitingOpen()

      channel.beginResponse('sender-id', 'https://example.com', contract, 'process-123', acceptAction)
      const awaitingDuring = channel.isAwaitingOpen()
      channel.completeScheduledOpen()

      expect([awaitingBefore, awaitingDuring, channel.isAwaitingOpen()]).toEqual([false, true, false])
    })

    it('reports true for the process id of the pending accept', () => {
      const channel = createChannel(config, deps)
      channel.beginResponse('sender-id', 'https://example.com', contract, 'process-123', acceptAction)

      expect(channel.isAwaitingOpen('process-123')).toBe(true)
    })

    it('reports false for another process id', () => {
      const channel = createChannel(config, deps)
      channel.beginResponse('sender-id', 'https://example.com', contract, 'process-123', acceptAction)

      expect(channel.isAwaitingOpen('process-other')).toBe(false)
    })

    it('reports false for a process id when nothing is pending', () => {
      const channel = createChannel(config, deps)

      expect(channel.isAwaitingOpen('process-123')).toBe(false)
    })
  })

  describe('scheduleActivation', () => {
    const contract = { accepted: [{ type: 'test' }], emitted: [] }

    it('answers the scheduled request when connect() is called', () => {
      const channel = createChannel(config, deps)
      channel.scheduleActivation('sender-id', 'https://example.com', contract, 'process-123')

      channel.connect()

      expect(deps.actions.acceptConnection).toHaveBeenCalledWith('process-123', undefined)
    })

    it('sends no connection request when a scheduled request is answered', () => {
      const channel = createChannel(config, deps)
      channel.scheduleActivation('sender-id', 'https://example.com', contract, 'process-123')

      channel.connect()

      expect(deps.actions.requestConnection).not.toHaveBeenCalled()
    })

    it('carries the security response into the ACCEPT when the broker serves the protocol', () => {
      const channel = createChannel(config, { ...deps, security })
      channel.scheduleActivation('sender-id', 'https://example.com', contract, 'process-123', { negotiated: 'v4' })

      channel.connect()

      expect(deps.actions.acceptConnection).toHaveBeenCalledWith('process-123', { negotiated: 'v4' })
    })

    it('answers with plaintext when no broker provider serves the protocol', () => {
      const channel = createChannel(config, deps)
      channel.scheduleActivation('sender-id', 'https://example.com', contract, 'process-123', { negotiated: 'v4' })

      channel.connect()

      expect(deps.actions.acceptConnection).toHaveBeenCalledWith('process-123', { negotiated: 'none' })
    })

    it('tracks the first scheduled request without removing anything', () => {
      const channel = createChannel(config, deps)

      channel.scheduleActivation('sender-id', 'https://example.com', contract, 'process-1')

      expect(deps.processManager.remove).not.toHaveBeenCalled()
    })

    it('removes the process a superseded request tracked', () => {
      const channel = createChannel(config, deps)
      channel.scheduleActivation('sender-id', 'https://example.com', contract, 'process-1')

      channel.scheduleActivation('sender-id', 'https://example.com', contract, 'process-2')

      expect(deps.processManager.remove).toHaveBeenCalledWith('process-1')
    })

    it('keeps the process when the same request is scheduled again', () => {
      const channel = createChannel(config, deps)
      channel.scheduleActivation('sender-id', 'https://example.com', contract, 'process-1')

      channel.scheduleActivation('sender-id', 'https://example.com', contract, 'process-1')

      expect(deps.processManager.remove).not.toHaveBeenCalled()
    })

    it('answers the latest scheduled request', () => {
      const channel = createChannel(config, deps)
      channel.scheduleActivation('sender-id', 'https://example.com', contract, 'process-1')
      channel.scheduleActivation('sender-id', 'https://example.com', contract, 'process-2')

      channel.connect()

      expect(deps.actions.acceptConnection).toHaveBeenCalledWith('process-2', undefined)
    })
  })

  describe('integration: subscription', () => {
    it('subscribe to events returns an unsubscribe function', () => {
      const channel = createChannel(config, deps)

      expect(typeof channel.on(jest.fn())).toBe('function')
    })

    it('subscribe to a specific event returns an unsubscribe function', () => {
      const channel = createChannel(config, deps)

      expect(typeof channel.on('open', jest.fn())).toBe('function')
    })

    it('event-specific handler receives the event data and the channel snapshot', () => {
      const channel = createChannel(config, deps)
      const openHandler = jest.fn()
      channel.on('open', openHandler)

      channel.notifyEvent('open', { origin: 'http://test.com', contract: { emitted: [], accepted: [] } })

      expect(openHandler).toHaveBeenCalledWith(
        { origin: 'http://test.com', contract: { emitted: [], accepted: [] } },
        expect.objectContaining({ name: 'test-channel' })
      )
    })

    it('event-specific handler ignores other events', () => {
      const channel = createChannel(config, deps)
      const closeHandler = jest.fn()
      channel.on('close', closeHandler)

      channel.notifyEvent('open', { origin: 'http://test.com', contract: { emitted: [], accepted: [] } })

      expect(closeHandler).not.toHaveBeenCalled()
    })

    it('subscribe to messages returns an unsubscribe function', () => {
      const channel = createChannel(config, deps)

      expect(typeof channel.onMessage(jest.fn())).toBe('function')
    })
  })

  describe('toJSON', () => {
    it('serializes channel to JSON', () => {
      const channel = createChannel(config, deps)

      expect(channel.toJSON()).toEqual({
        id: expect.any(String),
        name: 'test-channel',
        active: false,
        origin: null,
        connectTimestamp: null,
        contract: null,
        peerContract: null,
        peerId: null,
        queuedMessagesCount: 0,
      })
    })

    it('includes queued messages count', () => {
      const channel = createChannel(config, deps)

      channel.send('msg1', {})
      channel.send('msg2', {})

      expect(channel.toJSON().queuedMessagesCount).toBe(2)
    })
  })

  describe('cleanup', () => {
    it('calls cleanup callback on destroy', () => {
      const channel = createChannel(config, deps)

      channel.destroy()

      expect(deps.cleanup).toHaveBeenCalled()
    })

    it('works without cleanup callback', () => {
      const channel = createChannel(config, { ...deps, cleanup: undefined })

      expect(() => channel.destroy()).not.toThrow()
    })
  })

  describe('handle accessors', () => {
    const peerContract = { accepted: [{ type: 'msg1' }], emitted: [] }

    it('isClosing reports false while no polite close is in flight', () => {
      const channel = createChannel(config, deps)

      expect(channel.isClosing()).toBe(false)
    })

    it('isClosing reports true while a polite close awaits acknowledgement', () => {
      const channel = createChannel(config, deps)
      channel.activate('https://example.com', peerContract, 'peer-1')

      channel.disconnect()

      expect(channel.isClosing()).toBe(true)
    })

    it('reports no peer before activation', () => {
      const channel = createChannel(config, deps)

      expect({ peerId: channel.getPeerId(), peerContract: channel.getPeerContract() }).toEqual({ peerId: null, peerContract: null })
    })

    it('reports the peer details after activation', () => {
      const channel = createChannel(config, deps)

      channel.activate('https://example.com', peerContract, 'peer-1')

      expect({ peerId: channel.getPeerId(), peerContract: channel.getPeerContract() }).toEqual({ peerId: 'peer-1', peerContract })
    })

    it('reports the pending process id while a connection request is outstanding', () => {
      const channel = createChannel(config, deps)
      const before = channel.getPendingProcessId()

      channel.connect()

      expect([before, channel.getPendingProcessId()]).toEqual([null, 'process-1'])
    })

    it('abandonRequest removes the outstanding request process', () => {
      const channel = createChannel(config, deps)
      channel.connect()

      channel.abandonRequest()

      expect({ removed: (deps.processManager.remove as Mock).mock.calls, pending: channel.getPendingProcessId() }).toEqual({
        removed: [['process-1']],
        pending: null,
      })
    })

    it('cancel fires the cancel event', () => {
      const channel = createChannel(config, deps)
      const handler = jest.fn()
      channel.on('cancel', handler)

      channel.cancel(false)

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('sendAction posts a raw action to the target window', () => {
      const channel = createChannel(config, deps)
      const action: IAction = { type: '[nexus] connection-request', senderId: 'test-broker-id' }

      channel.sendAction(action)

      expect(window.postMessage).toHaveBeenCalledWith(action, '*')
    })

    it('completeConnection activates the channel and posts the reply action', () => {
      const channel = createChannel(config, deps)
      const openAction: IAction = { type: '[nexus] connection-opened', senderId: 'test-broker-id', processId: 'process-1' }

      channel.completeConnection('https://example.com', peerContract, 'peer-1', openAction)

      expect({ active: channel.isActive(), peerId: channel.getPeerId(), posted: (window.postMessage as Mock).mock.calls }).toEqual({
        active: true,
        peerId: 'peer-1',
        posted: [[openAction, 'https://example.com']],
      })
    })

    it('notifyMessage delivers the message to subscribers', () => {
      const channel = createChannel(config, deps)
      const handler = jest.fn()
      channel.onMessage(handler)

      channel.notifyMessage({ type: 'msg1', data: { seq: 1 } })

      expect(handler).toHaveBeenCalledWith({ type: 'msg1', data: { seq: 1 } })
    })
  })
})
