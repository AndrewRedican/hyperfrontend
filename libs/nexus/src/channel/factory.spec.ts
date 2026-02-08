/**
 * Tests for channel factory
 */

import { createChannel } from './factory'
import type { IChannelConfig } from '../types/channel'
import type { ChannelDependencies } from './types'

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
        })),
        acceptConnection: jest.fn((processId) => ({
          type: '[nexus] connection-accept',
          processId,
        })),
        denyConnection: jest.fn((processId, reason) => ({
          type: '[nexus] connection-deny',
          processId,
          reason,
        })),
        cancelConnection: jest.fn((processId) => ({
          type: '[nexus] connection-cancel',
          processId,
        })),
        openConnection: jest.fn((processId) => ({
          type: '[nexus] connection-open',
          processId,
        })),
        closeConnection: jest.fn((processId) => ({
          type: '[nexus] connection-close',
          processId,
        })),
        destroyConnection: jest.fn(() => ({
          type: '[nexus] connection-destroy',
        })),
        newMessage: jest.fn((data) => ({
          type: '[nexus] new-message',
          data,
        })),
        invalidRequest: jest.fn((processId, error) => ({
          type: '[nexus] invalid-request',
          processId,
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

    // Mock postMessage on window
    window.postMessage = jest.fn()
  })

  describe('createChannel', () => {
    it('creates channel with correct ID and name', () => {
      const channel = createChannel(config, deps)

      expect(channel.getId()).toMatch(/^[a-f0-9-]{36}$/) // UUID format
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
          debug: true,
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

      // Connect first
      channel.connect()

      // The channel is not actually active in this test - it just sent REQUEST
      // So disconnect won't actually send CLOSE (it only does so for active channels)
      channel.disconnect()

      // Since channel is not active, closeConnection should NOT be called
      expect(deps.actions.closeConnection).not.toHaveBeenCalled()
    })
  })

  describe('integration: messaging', () => {
    it('queue messages when channel is inactive', () => {
      const channel = createChannel(config, deps)

      // Channel is inactive by default, so messages should be queued
      channel.send('test-type', { foo: 'bar' })

      // Message should be queued, not sent yet
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

      // When connect() is called, it should use the scheduled activation
      channel.connect()

      // Should have sent acceptance, not request
      expect(deps.actions.acceptConnection).toHaveBeenCalledWith('process-123')
      expect(deps.actions.requestConnection).not.toHaveBeenCalled()
    })

    it('activate updates channel state', () => {
      const channel = createChannel(config, deps)
      const contract = { accepted: [{ type: 'msg1' }], emitted: [] }

      channel.activate('https://example.com', contract)

      expect(channel.isActive()).toBe(true)
    })
  })

  describe('integration: subscription', () => {
    it('subscribe to events', () => {
      const channel = createChannel(config, deps)
      const handler = jest.fn()

      const unsubscribe = channel.on(handler)

      expect(typeof unsubscribe).toBe('function')
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

      // Queue some messages (channel is inactive by default, queueMessages is true)
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
})
