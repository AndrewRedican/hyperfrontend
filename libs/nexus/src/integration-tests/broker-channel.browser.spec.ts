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

      const channel = broker.addChannel('test-channel', <Window>(<unknown>mockWindow))
      expect(channel).toBeDefined()
      expect(channel.name).toBe('test-channel')
      expect(channel.isActive()).toBe(false)

      channel.connect()
      expect(channel.isActive()).toBe(true)

      channel.disconnect()
      expect(channel.isActive()).toBe(false)
    })

    it('sends messages through channel', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: testContract,
      })

      const channel = broker.addChannel('test-channel', <Window>(<unknown>mockWindow))
      channel.connect()

      channel.send('PING', { timestamp: Date.now() })

      expect(mockWindow.postMessage).toHaveBeenCalled()
    })

    it('handles message subscription', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: testContract,
      })

      const channel = broker.addChannel('test-channel', <Window>(<unknown>mockWindow))
      const messageHandler = jest.fn()

      const unsubscribe = channel.onMessage(messageHandler)

      channel.connect()

      expect(unsubscribe).toBeInstanceOf(Function)

      unsubscribe()
      channel.disconnect()
    })

    it('handles event subscription', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: testContract,
      })

      const channel = broker.addChannel('test-channel', <Window>(<unknown>mockWindow))
      const eventHandler = jest.fn()

      const unsubscribe = channel.on(eventHandler)

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

      const channel = broker.addChannel('test-channel', <Window>(<unknown>mockWindow))
      channel.connect()

      mockWindow.postMessage.mockClear()

      channel.send('PING', { id: 1 })
      channel.send('DATA_REQUEST', { query: 'test' })

      expect(mockWindow.postMessage).toHaveBeenCalledTimes(2)
    })

    it('queues messages when channel is not active', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: testContract,
      })

      const channel = broker.addChannel('test-channel', <Window>(<unknown>mockWindow))

      channel.send('PING', { id: 1 })

      expect(mockWindow.postMessage).not.toHaveBeenCalled()

      channel.connect()

      expect(mockWindow.postMessage).toHaveBeenCalled()
    })
  })

  describe('State Transitions', () => {
    it('maintains proper state through lifecycle', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: testContract,
      })

      const channel = broker.addChannel('test-channel', <Window>(<unknown>mockWindow))

      expect(channel.isActive()).toBe(false)

      channel.connect()
      expect(channel.isActive()).toBe(true)

      channel.disconnect()
      expect(channel.isActive()).toBe(false)
    })

    it('handles repeated connect/disconnect cycles', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: testContract,
      })

      const channel = broker.addChannel('test-channel', <Window>(<unknown>mockWindow))

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

      const channel = broker.addChannel('test-channel', <Window>(<unknown>mockWindow))

      const byWindow = broker.getChannel(<Window>(<unknown>mockWindow))
      expect(byWindow).toBe(channel)

      const byName = broker.getChannel('test-channel')
      expect(byName).toBe(channel)

      const byId = broker.getChannel(channel.id)
      expect(byId).toBe(channel)
    })

    it('lists all channels', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: testContract,
      })

      const mockWindow2 = createMockWindow()

      broker.addChannel('channel-1', <Window>(<unknown>mockWindow))
      broker.addChannel('channel-2', <Window>(<unknown>mockWindow2))

      const channels = broker.channels
      expect(channels).toHaveLength(2)
    })

    it('reuses existing channel for same window', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: testContract,
      })

      const channel1 = broker.addChannel('first', <Window>(<unknown>mockWindow))
      const channel2 = broker.addChannel('second', <Window>(<unknown>mockWindow))

      expect(channel1).toBe(channel2)
    })
  })

  describe('Error Handling', () => {
    it('handles invalid message types gracefully', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: testContract,
      })

      const channel = broker.addChannel('test-channel', <Window>(<unknown>mockWindow))
      channel.connect()

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        channel.send(<any>'INVALID_TYPE', {})
      }).toThrow('not in the emitted actions')
    })

    it('handles disconnect of inactive channel', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: testContract,
      })

      const channel = broker.addChannel('test-channel', <Window>(<unknown>mockWindow))

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

      const channel = broker.addChannel('test-channel', <Window>(<unknown>mockWindow))
      channel.connect()

      const eventHandler = jest.fn()
      channel.on(eventHandler)

      channel.destroy()

      expect(channel.isActive()).toBe(false)
    })
  })
})
