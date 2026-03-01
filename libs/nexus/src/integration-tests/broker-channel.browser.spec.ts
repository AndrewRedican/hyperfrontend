import type { IChannelContract } from '../types/contract'
import type { MockWindow } from './test-utils'
import { createBroker } from '../broker/factory'
import { createMockWindow } from './test-utils'

describe('Integration: Broker + Channel', () => {
  let mockWindow: MockWindow

  beforeEach(() => {
    mockWindow = createMockWindow()
  })

  const testContract: IChannelContract = {
    emitted: [{ type: 'PING' }, { type: 'DATA_REQUEST' }],
    accepted: [{ type: 'PONG' }, { type: 'DATA_RESPONSE' }],
  }

  describe('Basic Communication Flow', () => {
    it('completes full connection lifecycle', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: testContract,
      })

      // Add channel
      const channel = broker.addChannel('test-channel', mockWindow as unknown as Window)
      expect(channel).toBeDefined()
      expect(channel.name).toBe('test-channel')
      expect(channel.isActive()).toBe(false)

      // Connect
      channel.connect()
      expect(channel.isActive()).toBe(true)

      // Disconnect
      channel.disconnect()
      expect(channel.isActive()).toBe(false)
    })

    it('sends messages through channel', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: testContract,
      })

      const channel = broker.addChannel('test-channel', mockWindow as unknown as Window)
      channel.connect()

      // Send message
      channel.send('PING', { timestamp: Date.now() })

      // Verify postMessage was called
      expect(mockWindow.postMessage).toHaveBeenCalled()
    })

    it('handles message subscription', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: testContract,
      })

      const channel = broker.addChannel('test-channel', mockWindow as unknown as Window)
      const messageHandler = jest.fn()

      // Subscribe to messages
      const unsubscribe = channel.onMessage(messageHandler)

      // Connect and send
      channel.connect()

      // Verify subscription setup works (messages arrive via postMessage events)
      expect(unsubscribe).toBeInstanceOf(Function)

      // Cleanup
      unsubscribe()
      channel.disconnect()
    })

    it('handles event subscription', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: testContract,
      })

      const channel = broker.addChannel('test-channel', mockWindow as unknown as Window)
      const eventHandler = jest.fn()

      // Subscribe to open events
      const unsubscribe = channel.on(eventHandler)

      // Connect should trigger open event
      channel.connect()

      expect(eventHandler).toHaveBeenCalledWith(
        'open',
        expect.objectContaining({
          id: expect.any(String),
          origin: '*',
        }),
        expect.any(Object)
      )

      unsubscribe()
    })
  })

  describe('Message Routing', () => {
    it('routes messages from channel to target window', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: testContract,
      })

      const channel = broker.addChannel('test-channel', mockWindow as unknown as Window)
      channel.connect()

      // Clear previous calls
      mockWindow.postMessage.mockClear()

      // Send multiple messages
      channel.send('PING', { id: 1 })
      channel.send('DATA_REQUEST', { query: 'test' })

      expect(mockWindow.postMessage).toHaveBeenCalledTimes(2)
    })

    it('queues messages when channel is not active', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: testContract,
      })

      const channel = broker.addChannel('test-channel', mockWindow as unknown as Window)

      // Send message before connecting
      channel.send('PING', { id: 1 })

      // Message should be queued, not sent immediately
      expect(mockWindow.postMessage).not.toHaveBeenCalled()

      // Connect should flush the queue
      channel.connect()

      // Now the message should be sent
      expect(mockWindow.postMessage).toHaveBeenCalled()
    })
  })

  describe('State Transitions', () => {
    it('maintains proper state through lifecycle', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: testContract,
      })

      const channel = broker.addChannel('test-channel', mockWindow as unknown as Window)

      // Initial state
      expect(channel.isActive()).toBe(false)

      // After connect
      channel.connect()
      expect(channel.isActive()).toBe(true)

      // After disconnect
      channel.disconnect()
      expect(channel.isActive()).toBe(false)
    })

    it('handles repeated connect/disconnect cycles', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: testContract,
      })

      const channel = broker.addChannel('test-channel', mockWindow as unknown as Window)

      // Multiple cycles
      for (let i = 0; i < 3; i++) {
        channel.connect()
        expect(channel.isActive()).toBe(true)

        channel.disconnect()
        expect(channel.isActive()).toBe(false)
      }
    })
  })

  describe('Broker Channel Management', () => {
    it('retrieves channel by different references', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: testContract,
      })

      const channel = broker.addChannel('test-channel', mockWindow as unknown as Window)

      // Get by window
      const byWindow = broker.getChannel(mockWindow as unknown as Window)
      expect(byWindow).toBe(channel)

      // Get by name
      const byName = broker.getChannel('test-channel')
      expect(byName).toBe(channel)

      // Get by ID
      const byId = broker.getChannel(channel.id)
      expect(byId).toBe(channel)
    })

    it('lists all channels', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: testContract,
      })

      const mockWindow2 = createMockWindow()

      broker.addChannel('channel-1', mockWindow as unknown as Window)
      broker.addChannel('channel-2', mockWindow2 as unknown as Window)

      const channels = broker.channels
      expect(channels).toHaveLength(2)
    })

    it('reuses existing channel for same window', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: testContract,
      })

      const channel1 = broker.addChannel('first', mockWindow as unknown as Window)
      const channel2 = broker.addChannel('second', mockWindow as unknown as Window)

      expect(channel1).toBe(channel2)
    })
  })

  describe('Error Handling', () => {
    it('handles invalid message types gracefully', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: testContract,
      })

      const channel = broker.addChannel('test-channel', mockWindow as unknown as Window)
      channel.connect()

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        channel.send('INVALID_TYPE' as any, {})
      }).toThrow('not in the emitted actions')
    })

    it('handles disconnect of inactive channel', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: testContract,
      })

      const channel = broker.addChannel('test-channel', mockWindow as unknown as Window)

      // Disconnect without connecting
      expect(() => {
        channel.disconnect()
      }).not.toThrow()
    })
  })
  describe('Cleanup', () => {
    it('cleans up resources on destroy', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: testContract,
      })

      const channel = broker.addChannel('test-channel', mockWindow as unknown as Window)
      channel.connect()

      const eventHandler = jest.fn()
      channel.on(eventHandler)

      // Destroy should trigger cleanup
      channel.destroy()

      expect(channel.isActive()).toBe(false)
    })
  })
})
