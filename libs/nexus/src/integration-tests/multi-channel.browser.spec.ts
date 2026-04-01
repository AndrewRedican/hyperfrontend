import type { IChannelContract } from '../types/contract'
import type { MockWindow } from './test-utils'
import { createBroker } from '../broker/factory'
import { createMockWindow } from './test-utils'

describe('Integration: Multi-Channel', () => {
  let mockWindow1: MockWindow
  let mockWindow2: MockWindow
  let mockWindow3: MockWindow

  beforeEach(() => {
    mockWindow1 = createMockWindow()
    mockWindow2 = createMockWindow()
    mockWindow3 = createMockWindow()
  })

  const testContract: IChannelContract = {
    emitted: [{ type: 'BROADCAST' }, { type: 'DIRECT_MESSAGE' }],
    accepted: [{ type: 'ACK' }, { type: 'RESPONSE' }],
  }

  describe('Multiple Channel Management', () => {
    it('manages multiple channels independently', () => {
      const broker = createBroker({
        name: 'multi-broker',
        contract: testContract,
        settings: { logLevel: 'error' },
      })

      const channel1 = broker.addChannel('channel-1', <Window>(<unknown>mockWindow1))
      const channel2 = broker.addChannel('channel-2', <Window>(<unknown>mockWindow2))
      const channel3 = broker.addChannel('channel-3', <Window>(<unknown>mockWindow3))

      expect(channel1.name).toBe('channel-1')
      expect(channel2.name).toBe('channel-2')
      expect(channel3.name).toBe('channel-3')

      expect(broker.channels).toHaveLength(3)
    })

    it('connects/disconnects channels independently', () => {
      const broker = createBroker({
        name: 'multi-broker',
        contract: testContract,
        settings: { logLevel: 'error' },
      })

      const channel1 = broker.addChannel('channel-1', <Window>(<unknown>mockWindow1))
      const channel2 = broker.addChannel('channel-2', <Window>(<unknown>mockWindow2))
      const channel3 = broker.addChannel('channel-3', <Window>(<unknown>mockWindow3))

      channel1.connect()
      channel3.connect()

      expect(channel1.isActive()).toBe(true)
      expect(channel2.isActive()).toBe(false)
      expect(channel3.isActive()).toBe(true)

      channel1.disconnect()

      expect(channel1.isActive()).toBe(false)
      expect(channel2.isActive()).toBe(false)
      expect(channel3.isActive()).toBe(true)
    })
  })

  describe('Message Isolation', () => {
    it('isolates messages between channels', () => {
      const broker = createBroker({
        name: 'multi-broker',
        contract: testContract,
        settings: { logLevel: 'error' },
      })

      const channel1 = broker.addChannel('channel-1', <Window>(<unknown>mockWindow1))
      const channel2 = broker.addChannel('channel-2', <Window>(<unknown>mockWindow2))

      channel1.connect()
      channel2.connect()

      mockWindow1.postMessage.mockClear()
      mockWindow2.postMessage.mockClear()

      channel1.send('BROADCAST', { from: 'channel-1' })

      expect(mockWindow1.postMessage).toHaveBeenCalledTimes(1)
      expect(mockWindow2.postMessage).not.toHaveBeenCalled()

      channel2.send('BROADCAST', { from: 'channel-2' })

      expect(mockWindow1.postMessage).toHaveBeenCalledTimes(1)
      expect(mockWindow2.postMessage).toHaveBeenCalledTimes(1)
    })

    it('maintains separate message queues', () => {
      const broker = createBroker({
        name: 'multi-broker',
        contract: testContract,
        settings: { logLevel: 'error' },
      })

      const channel1 = broker.addChannel('channel-1', <Window>(<unknown>mockWindow1))
      const channel2 = broker.addChannel('channel-2', <Window>(<unknown>mockWindow2))

      channel1.send('BROADCAST', { id: 1 })
      channel1.send('BROADCAST', { id: 2 })
      channel2.send('BROADCAST', { id: 3 })

      channel1.connect()

      expect(mockWindow1.postMessage).toHaveBeenCalled()
      expect(mockWindow2.postMessage).not.toHaveBeenCalled()

      channel2.connect()

      expect(mockWindow2.postMessage).toHaveBeenCalled()
    })
  })

  describe('Event Isolation', () => {
    it('isolates events between channels', () => {
      const broker = createBroker({
        name: 'multi-broker',
        contract: testContract,
        settings: { logLevel: 'error' },
      })

      const channel1 = broker.addChannel('channel-1', <Window>(<unknown>mockWindow1))
      const channel2 = broker.addChannel('channel-2', <Window>(<unknown>mockWindow2))

      const handler1 = jest.fn()
      const handler2 = jest.fn()

      channel1.on(handler1)
      channel2.on(handler2)

      channel1.connect()

      expect(handler1).toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()

      handler1.mockClear()
      handler2.mockClear()

      channel2.connect()

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
    })

    it('handles unsubscribe for specific channels', () => {
      const broker = createBroker({
        name: 'multi-broker',
        contract: testContract,
        settings: { logLevel: 'error' },
      })

      const channel1 = broker.addChannel('channel-1', <Window>(<unknown>mockWindow1))
      const channel2 = broker.addChannel('channel-2', <Window>(<unknown>mockWindow2))

      const handler1 = jest.fn()
      const handler2 = jest.fn()

      const unsubscribe1 = channel1.on(handler1)
      channel2.on(handler2)

      unsubscribe1()

      channel1.connect()
      channel2.connect()

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
    })
  })

  describe('Concurrent Operations', () => {
    it('handles concurrent connects', () => {
      const broker = createBroker({
        name: 'multi-broker',
        contract: testContract,
        settings: { logLevel: 'error' },
      })

      const channel1 = broker.addChannel('channel-1', <Window>(<unknown>mockWindow1))
      const channel2 = broker.addChannel('channel-2', <Window>(<unknown>mockWindow2))
      const channel3 = broker.addChannel('channel-3', <Window>(<unknown>mockWindow3))

      channel1.connect()
      channel2.connect()
      channel3.connect()

      expect(channel1.isActive()).toBe(true)
      expect(channel2.isActive()).toBe(true)
      expect(channel3.isActive()).toBe(true)
    })

    it('handles concurrent messaging', () => {
      const broker = createBroker({
        name: 'multi-broker',
        contract: testContract,
        settings: { logLevel: 'error' },
      })

      const channel1 = broker.addChannel('channel-1', <Window>(<unknown>mockWindow1))
      const channel2 = broker.addChannel('channel-2', <Window>(<unknown>mockWindow2))
      const channel3 = broker.addChannel('channel-3', <Window>(<unknown>mockWindow3))

      channel1.connect()
      channel2.connect()
      channel3.connect()

      mockWindow1.postMessage.mockClear()
      mockWindow2.postMessage.mockClear()
      mockWindow3.postMessage.mockClear()

      channel1.send('BROADCAST', { from: 1 })
      channel2.send('BROADCAST', { from: 2 })
      channel3.send('BROADCAST', { from: 3 })

      expect(mockWindow1.postMessage).toHaveBeenCalledTimes(1)
      expect(mockWindow2.postMessage).toHaveBeenCalledTimes(1)
      expect(mockWindow3.postMessage).toHaveBeenCalledTimes(1)
    })

    it('handles concurrent disconnects', () => {
      const broker = createBroker({
        name: 'multi-broker',
        contract: testContract,
        settings: { logLevel: 'error' },
      })

      const channel1 = broker.addChannel('channel-1', <Window>(<unknown>mockWindow1))
      const channel2 = broker.addChannel('channel-2', <Window>(<unknown>mockWindow2))
      const channel3 = broker.addChannel('channel-3', <Window>(<unknown>mockWindow3))

      channel1.connect()
      channel2.connect()
      channel3.connect()

      channel1.disconnect()
      channel2.disconnect()
      channel3.disconnect()

      expect(channel1.isActive()).toBe(false)
      expect(channel2.isActive()).toBe(false)
      expect(channel3.isActive()).toBe(false)
    })
  })

  describe('Channel Lifecycle Mix', () => {
    it('handles mixed lifecycle states', () => {
      const broker = createBroker({
        name: 'multi-broker',
        contract: testContract,
        settings: { logLevel: 'error' },
      })

      const channel1 = broker.addChannel('channel-1', <Window>(<unknown>mockWindow1))
      const channel2 = broker.addChannel('channel-2', <Window>(<unknown>mockWindow2))
      const channel3 = broker.addChannel('channel-3', <Window>(<unknown>mockWindow3))

      channel1.connect()

      channel3.connect()
      channel3.disconnect()

      expect(channel1.isActive()).toBe(true)
      expect(channel2.isActive()).toBe(false)
      expect(channel3.isActive()).toBe(false)

      mockWindow1.postMessage.mockClear()
      mockWindow2.postMessage.mockClear()
      mockWindow3.postMessage.mockClear()

      channel1.send('BROADCAST', { id: 1 })
      channel2.send('BROADCAST', { id: 2 })
      channel3.send('BROADCAST', { id: 3 })

      expect(mockWindow1.postMessage).toHaveBeenCalled()
      expect(mockWindow2.postMessage).not.toHaveBeenCalled()
      expect(mockWindow3.postMessage).not.toHaveBeenCalled()
    })
  })

  describe('Performance', () => {
    it('handles many channels efficiently', () => {
      const broker = createBroker({
        name: 'multi-broker',
        contract: testContract,
        settings: { logLevel: 'error' },
      })

      const channelCount = 100
      const channels: ReturnType<typeof broker.addChannel>[] = []

      for (let i = 0; i < channelCount; i++) {
        const mockWin = createMockWindow()
        const channel = broker.addChannel(`channel-${i}`, <Window>(<unknown>mockWin))
        channels.push(channel)
      }

      expect(broker.channels).toHaveLength(channelCount)

      channels.forEach((ch) => ch.connect())

      channels.forEach((ch) => {
        expect(ch.isActive()).toBe(true)
      })
    })
  })
})
