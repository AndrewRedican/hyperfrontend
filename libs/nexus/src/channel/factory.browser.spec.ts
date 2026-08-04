import type { IChannelConfig } from '../types/channel'
import type { SecurityNegotiationRequest, SecurityTransport } from '../types/security'
import type { ChannelDependencies } from './types'
import { hasOwn } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createChannel } from './factory'

describe('channel/factory', () => {
  let config: IChannelConfig
  let deps: ChannelDependencies
  let createdProcesses: string[]

  beforeEach(() => {
    createdProcesses = []

    config = {
      name: 'test-channel',
      target: window,
    }

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
          const processId = `process-${Date.now()}`
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
    it('creates channel with correct ID and name', () => {
      const channel = createChannel(config, deps)

      expect(channel.getId()).toMatch(/^[a-f0-9-]{36}$/)
      expect(channel.getName()).toBe('test-channel')
      expect(channel.getTarget()).toBe(window)
      expect(channel.isActive()).toBe(false)
    })

    it('creates channel with default settings', () => {
      const channel = createChannel(config, deps)
      const json = channel.toJSON()

      expect(json.active).toBe(false)
      expect(json.origin).toBeNull()
      expect(json.connectTimestamp).toBeNull()
      expect(json.contract).toBeNull()
      expect(json.queuedMessagesCount).toBe(0)
    })

    it('creates channel with custom settings', () => {
      const customConfig = {
        ...config,
        settings: {
          origin: 'https://example.com',
          queueMessages: false,
          logLevel: 'debug',
        },
      }

      const channel = createChannel(customConfig, deps)

      expect(channel.getName()).toBe('test-channel')
      expect(channel.isActive()).toBe(false)
    })

    it('exposes lifecycle methods', () => {
      const channel = createChannel(config, deps)

      expect(typeof channel.connect).toBe('function')
      expect(typeof channel.disconnect).toBe('function')
      expect(typeof channel.cancel).toBe('function')
      expect(typeof channel.destroy).toBe('function')
    })

    it('exposes messaging methods', () => {
      const channel = createChannel(config, deps)

      expect(typeof channel.send).toBe('function')
      expect(typeof channel.sendAction).toBe('function')
    })

    it('exposes subscription methods', () => {
      const channel = createChannel(config, deps)

      expect(typeof channel.on).toBe('function')
      expect(typeof channel.onMessage).toBe('function')
    })
  })

  describe('integration: lifecycle', () => {
    it('connect channel', () => {
      const channel = createChannel(config, deps)

      channel.connect()

      expect(deps.processManager.create).toHaveBeenCalled()
      expect(deps.actions.requestConnection).toHaveBeenCalled()
    })

    it('disconnect active channel', () => {
      const channel = createChannel(config, deps)

      channel.connect()

      channel.disconnect()

      expect(deps.actions.closeConnection).not.toHaveBeenCalled()
    })
  })

  describe('integration: messaging', () => {
    it('queue messages when channel is inactive', () => {
      const channel = createChannel(config, deps)

      channel.send('test-type', { foo: 'bar' })

      const json = channel.toJSON()
      expect(json.queuedMessagesCount).toBe(1)
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
      const brokerManagedConfig = {
        ...config,
        settings: { brokerManaged: true },
      }
      const channel = createChannel(brokerManagedConfig, deps)

      expect(channel.isReadyToConnect()).toBe(false)
    })

    it('registers the channel handle with the process manager', () => {
      const channel = createChannel(config, deps)

      channel.connect()

      expect(deps.processManager.create).toHaveBeenCalledWith(channel)
    })

    it('scheduleActivation stores activation data', () => {
      const channel = createChannel(config, deps)
      const contract = { accepted: [{ type: 'test' }], emitted: [] }

      channel.scheduleActivation('sender-id', 'https://example.com', contract, 'process-123')

      channel.connect()

      expect(deps.actions.acceptConnection).toHaveBeenCalledWith('process-123', undefined)
      expect(deps.actions.requestConnection).not.toHaveBeenCalled()
    })

    it('scheduleActivation carries the security response into the ACCEPT', () => {
      const channel = createChannel(config, deps)
      const contract = { accepted: [{ type: 'test' }], emitted: [] }

      channel.scheduleActivation('sender-id', 'https://example.com', contract, 'process-123', { negotiated: 'v2' })

      channel.connect()

      expect(deps.actions.acceptConnection).toHaveBeenCalledWith('process-123', { negotiated: 'v2' })
    })

    it('isAwaitingOpen reports the window between ACCEPT and OPEN', () => {
      const channel = createChannel(config, deps)
      const contract = { accepted: [{ type: 'test' }], emitted: [] }
      const awaitingBefore = channel.isAwaitingOpen()

      channel.beginResponse('sender-id', 'https://example.com', contract, 'process-123', {
        type: '[nexus] connection-request-accepted',
        senderId: 'test-broker-id',
      })
      const awaitingDuring = channel.isAwaitingOpen()
      channel.completeScheduledOpen()

      expect([awaitingBefore, awaitingDuring, channel.isAwaitingOpen()]).toEqual([false, true, false])
    })

    it('activate updates channel state', () => {
      const channel = createChannel(config, deps)
      const contract = { accepted: [{ type: 'msg1' }], emitted: [] }

      channel.activate('https://example.com', contract)

      expect(channel.isActive()).toBe(true)
    })

    it('getAcceptedTypes returns an empty list before activation', () => {
      const channel = createChannel(config, deps)

      expect(channel.getAcceptedTypes()).toEqual([])
    })

    it('getAcceptedTypes returns the own accepted types after activation', () => {
      const configWithContract = {
        ...config,
        settings: { contract: { accepted: [{ type: 'msg1' }, { type: 'msg2' }], emitted: [] } },
      }
      const channel = createChannel(configWithContract, deps)

      channel.activate('https://example.com', { accepted: [{ type: 'other' }], emitted: [] }, 'peer-1')

      expect(channel.getAcceptedTypes()).toEqual(['msg1', 'msg2'])
    })
  })

  describe('integration: subscription', () => {
    it('subscribe to events', () => {
      const channel = createChannel(config, deps)
      const handler = jest.fn()

      const unsubscribe = channel.on(handler)

      expect(typeof unsubscribe).toBe('function')
    })

    it('subscribe to events with event-specific handler', () => {
      const channel = createChannel(config, deps)
      const handler = jest.fn()

      const unsubscribe = channel.on('open', handler)

      expect(typeof unsubscribe).toBe('function')
    })

    it('event-specific handler receives correct arguments', () => {
      const channel = createChannel(config, deps)
      const openHandler = jest.fn()
      const closeHandler = jest.fn()

      channel.on('open', openHandler)
      channel.on('close', closeHandler)

      channel.notifyEvent('open', { origin: 'http://test.com', contract: { emitted: [], accepted: [] } })

      expect(openHandler).toHaveBeenCalledTimes(1)
      expect(openHandler).toHaveBeenCalledWith(
        { origin: 'http://test.com', contract: { emitted: [], accepted: [] } },
        expect.objectContaining({ name: 'test-channel' })
      )
      expect(closeHandler).not.toHaveBeenCalled()
    })

    it('subscribe to messages', () => {
      const channel = createChannel(config, deps)
      const handler = jest.fn()

      const unsubscribe = channel.onMessage(handler)

      expect(typeof unsubscribe).toBe('function')
    })
  })

  describe('toJSON', () => {
    it('serializes channel to JSON', () => {
      const channel = createChannel(config, deps)
      const json = channel.toJSON()

      expect(json).toEqual({
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

      const json = channel.toJSON()
      expect(json.queuedMessagesCount).toBe(2)
    })
  })

  describe('cleanup', () => {
    it('calls cleanup callback on destroy', () => {
      const channel = createChannel(config, deps)

      channel.destroy()

      expect(deps.cleanup).toHaveBeenCalled()
    })

    it('works without cleanup callback', () => {
      const depsWithoutCleanup = { ...deps, cleanup: undefined }
      const channel = createChannel(config, depsWithoutCleanup)

      expect(() => channel.destroy()).not.toThrow()
    })
  })

  describe('security methods', () => {
    it('sets and gets pending security request', () => {
      const channel = createChannel(config, deps)
      const securityRequest: SecurityNegotiationRequest = { supported: ['v1', 'v2'], preferred: 'v2' }

      expect(channel.getPendingSecurityRequest()).toBeNull()

      channel.setPendingSecurityRequest(securityRequest)

      expect(channel.getPendingSecurityRequest()).toEqual(securityRequest)

      channel.setPendingSecurityRequest(null)

      expect(channel.getPendingSecurityRequest()).toBeNull()
    })

    it('sets and gets negotiated protocol', () => {
      const channel = createChannel(config, deps)

      expect(channel.getNegotiatedProtocol()).toBeNull()

      channel.setNegotiatedProtocol('v2')

      expect(channel.getNegotiatedProtocol()).toBe('v2')
    })

    it('sets and gets security transport', () => {
      const channel = createChannel(config, deps)
      const mockTransport: SecurityTransport = {
        send: jest.fn(),
        receive: jest.fn(),
        stop: jest.fn(),
        resume: jest.fn(),
        isReady: jest.fn(() => true),
        getProtocol: jest.fn(() => 'v1'),
      }

      expect(channel.getSecurityTransport()).toBeNull()

      channel.setSecurityTransport(mockTransport)

      expect(channel.getSecurityTransport()).toBe(mockTransport)

      channel.setSecurityTransport(null)

      expect(channel.getSecurityTransport()).toBeNull()
    })

    it('sets and checks security ready state', () => {
      const channel = createChannel(config, deps)

      expect(channel.isSecurityReady()).toBe(false)

      channel.setSecurityReady(true)

      expect(channel.isSecurityReady()).toBe(true)

      channel.setSecurityReady(false)

      expect(channel.isSecurityReady()).toBe(false)
    })

    it('getSecuritySettings returns null when no security settings were provided', () => {
      const channel = createChannel(config, deps)

      expect(channel.getSecuritySettings()).toBeNull()
    })

    it('getSecuritySettings returns the configured security settings', () => {
      const channel = createChannel({ ...config, settings: { security: { protocol: 'v2', mode: 'fail-closed' } } }, deps)

      expect(channel.getSecuritySettings()).toEqual({ protocol: 'v2', mode: 'fail-closed' })
    })

    it('applySecuritySettings sets the settings on a channel created without any', () => {
      const channel = createChannel(config, deps)

      channel.applySecuritySettings({ protocol: 'v2', mode: 'fail-closed' })

      expect(channel.getSecuritySettings()).toEqual({ protocol: 'v2', mode: 'fail-closed' })
    })

    it('applySecuritySettings keeps the settings the channel was created with', () => {
      const channel = createChannel({ ...config, settings: { security: { protocol: 'v2' } } }, deps)

      channel.applySecuritySettings({ protocol: 'v1' })

      expect(channel.getSecuritySettings()).toEqual({ protocol: 'v2' })
    })

    it('getContractCompat returns null when no compatibility rule was provided', () => {
      const channel = createChannel(config, deps)

      expect(channel.getContractCompat()).toBeNull()
    })

    it('getContractCompat returns the configured compatibility rule', () => {
      const contractCompat = () => <const>{ compatible: true }
      const channel = createChannel({ ...config, settings: { contractCompat } }, deps)

      expect(channel.getContractCompat()).toBe(contractCompat)
    })
  })

  describe('queue-while-transport-not-ready', () => {
    function createTogglingTransport(): { transport: SecurityTransport; setReady: (ready: boolean) => void; sent: unknown[] } {
      const sent: unknown[] = []
      let ready = false
      return {
        transport: {
          send: (action) => {
            sent.push(action)
          },
          receive: jest.fn(),
          stop: jest.fn(),
          resume: jest.fn(),
          isReady: () => ready,
          getProtocol: () => 'x-external',
        },
        setReady: (value: boolean) => {
          ready = value
        },
        sent,
      }
    }

    function createActiveSecureChannel(transport: SecurityTransport) {
      const channel = createChannel({ ...config, settings: { contract: { accepted: [], emitted: [{ type: 'msg1' }] } } }, deps)
      channel.activate('https://example.com', { accepted: [{ type: 'msg1' }], emitted: [] }, 'peer-1')
      channel.setNegotiatedProtocol('x-external')
      channel.setSecurityTransport(transport)
      return channel
    }

    it('queues product messages while the transport reports not ready', () => {
      const { transport, sent } = createTogglingTransport()
      const channel = createActiveSecureChannel(transport)

      channel.send('msg1', { seq: 1 })

      expect({ queued: channel.toJSON().queuedMessagesCount, sent }).toEqual({ queued: 1, sent: [] })
    })

    it('flushes queued messages through the transport once readiness is signalled', () => {
      const { transport, setReady, sent } = createTogglingTransport()
      const channel = createActiveSecureChannel(transport)
      channel.send('msg1', { seq: 1 })
      channel.send('msg1', { seq: 2 })

      setReady(true)
      channel.setSecurityReady(true)

      expect({ queued: channel.toJSON().queuedMessagesCount, sent }).toEqual({
        queued: 0,
        sent: [
          expect.objectContaining({ type: '[nexus] new-message', data: expect.objectContaining({ data: { seq: 1 } }) }),
          expect.objectContaining({ type: '[nexus] new-message', data: expect.objectContaining({ data: { seq: 2 } }) }),
        ],
      })
    })

    it('keeps messages queued when readiness is signalled but the transport still reports not ready', () => {
      const { transport, sent } = createTogglingTransport()
      const channel = createActiveSecureChannel(transport)
      channel.send('msg1', { seq: 1 })

      channel.setSecurityReady(true)

      expect({ queued: channel.toJSON().queuedMessagesCount, sent }).toEqual({ queued: 1, sent: [] })
    })

    it('sends a payload-less message without a data key so envelope serializability validation passes', () => {
      const { transport, setReady, sent } = createTogglingTransport()
      const channel = createActiveSecureChannel(transport)
      setReady(true)

      channel.send('msg1')

      expect(sent).toEqual([{ type: '[nexus] new-message', senderId: 'test-broker-id', data: { type: 'msg1' } }])
      expect(hasOwn(<object>(<{ data: unknown }>sent[0]).data, 'data')).toBe(false)
    })

    it('does not flush when the channel is not active', () => {
      const { transport, setReady, sent } = createTogglingTransport()
      const channel = createChannel({ ...config, settings: { contract: { accepted: [], emitted: [{ type: 'msg1' }] } } }, deps)
      channel.setNegotiatedProtocol('x-external')
      channel.setSecurityTransport(transport)
      channel.send('msg1', { seq: 1 })

      setReady(true)
      channel.setSecurityReady(true)

      expect({ queued: channel.toJSON().queuedMessagesCount, sent }).toEqual({ queued: 1, sent: [] })
    })
  })

  describe('scheduleActivation', () => {
    it('schedules activation with provided details', () => {
      const channel = createChannel(config, deps)
      const contract = { accepted: [{ type: 'msg1' }], emitted: [] }

      channel.scheduleActivation('sender-id', 'https://example.com', contract, 'process-123')

      expect(channel.toJSON()).toBeDefined()
    })
  })

  describe('isReadyToConnect', () => {
    it('returns false by default for non-broker-managed channels', () => {
      const channel = createChannel(config, deps)

      expect(channel.isReadyToConnect()).toBe(false)
    })

    it('returns true after connect is called', () => {
      const channel = createChannel(config, deps)

      channel.connect()

      expect(channel.isReadyToConnect()).toBe(true)
    })
  })
})
