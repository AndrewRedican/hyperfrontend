import type { IChannelConfig } from '../types/channel'
import type { SecurityNegotiationRequest, SecurityTransport } from '../types/security'
import type { ChannelDependencies } from './types'
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

    it('isReadyToConnect returns true for broker-managed channels', () => {
      const brokerManagedConfig = {
        ...config,
        settings: { brokerManaged: true },
      }
      const channel = createChannel(brokerManagedConfig, deps)

      expect(channel.isReadyToConnect()).toBe(true)
    })

    it('scheduleActivation stores activation data', () => {
      const channel = createChannel(config, deps)
      const contract = { accepted: [{ type: 'test' }], emitted: [] }

      channel.scheduleActivation('sender-id', 'https://example.com', contract, 'process-123')

      channel.connect()

      expect(deps.actions.acceptConnection).toHaveBeenCalledWith('process-123')
      expect(deps.actions.requestConnection).not.toHaveBeenCalled()
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

    it('getAcceptedTypes returns the accepted types after activation', () => {
      const channel = createChannel(config, deps)
      const contract = { accepted: [{ type: 'msg1' }, { type: 'msg2' }], emitted: [] }

      channel.activate('https://example.com', contract)

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
        onReceive: jest.fn(),
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
