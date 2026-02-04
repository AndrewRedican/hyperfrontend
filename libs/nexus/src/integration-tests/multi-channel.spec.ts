/**
 * Integration Tests: Multi-Channel Scenarios
 *
 * Tests broker managing multiple channels with proper message isolation and routing.
 */

import { createBroker } from '../broker'
import type { IChannelContract } from '../types'
import { createMockWindow, type MockWindow } from './test-utils'

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
        settings: { debug: false },
      })

      const channel1 = broker.addChannel('channel-1', mockWindow1 as unknown as Window)
      const channel2 = broker.addChannel('channel-2', mockWindow2 as unknown as Window)
      const channel3 = broker.addChannel('channel-3', mockWindow3 as unknown as Window)

      expect(channel1.name).toBe('channel-1')
      expect(channel2.name).toBe('channel-2')
      expect(channel3.name).toBe('channel-3')

      expect(broker.channels).toHaveLength(3)
    })

    it('connects/disconnects channels independently', () => {
      const broker = createBroker({
        name: 'multi-broker',
        contract: testContract,
        settings: { debug: false },
      })

      const channel1 = broker.addChannel('channel-1', mockWindow1 as unknown as Window)
      const channel2 = broker.addChannel('channel-2', mockWindow2 as unknown as Window)
      const channel3 = broker.addChannel('channel-3', mockWindow3 as unknown as Window)

      // Connect only channel1 and channel3
      channel1.connect()
      channel3.connect()

      expect(channel1.isActive()).toBe(true)
      expect(channel2.isActive()).toBe(false)
      expect(channel3.isActive()).toBe(true)

      // Disconnect channel1
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
        settings: { debug: false },
      })

      const channel1 = broker.addChannel('channel-1', mockWindow1 as unknown as Window)
      const channel2 = broker.addChannel('channel-2', mockWindow2 as unknown as Window)

      channel1.connect()
      channel2.connect()

      // Clear any connection messages
      mockWindow1.postMessage.mockClear()
      mockWindow2.postMessage.mockClear()

      // Send message through channel1
      channel1.send('BROADCAST', { from: 'channel-1' })

      // Only window1 should receive the message
      expect(mockWindow1.postMessage).toHaveBeenCalledTimes(1)
      expect(mockWindow2.postMessage).not.toHaveBeenCalled()

      // Send message through channel2
      channel2.send('BROADCAST', { from: 'channel-2' })

      // Only window2 should receive the new message
      expect(mockWindow1.postMessage).toHaveBeenCalledTimes(1) // Still 1
      expect(mockWindow2.postMessage).toHaveBeenCalledTimes(1)
    })

    it('maintains separate message queues', () => {
      const broker = createBroker({
        name: 'multi-broker',
        contract: testContract,
        settings: { debug: false },
      })

      const channel1 = broker.addChannel('channel-1', mockWindow1 as unknown as Window)
      const channel2 = broker.addChannel('channel-2', mockWindow2 as unknown as Window)

      // Send messages before connecting
      channel1.send('BROADCAST', { id: 1 })
      channel1.send('BROADCAST', { id: 2 })
      channel2.send('BROADCAST', { id: 3 })

      // Connect channel1 first
      channel1.connect()

      // Only channel1 messages should be sent
      expect(mockWindow1.postMessage).toHaveBeenCalled()
      expect(mockWindow2.postMessage).not.toHaveBeenCalled()

      // Connect channel2
      channel2.connect()

      // Now channel2 messages should be sent
      expect(mockWindow2.postMessage).toHaveBeenCalled()
    })
  })

  describe('Event Isolation', () => {
    it('isolates events between channels', () => {
      const broker = createBroker({
        name: 'multi-broker',
        contract: testContract,
        settings: { debug: false },
      })

      const channel1 = broker.addChannel('channel-1', mockWindow1 as unknown as Window)
      const channel2 = broker.addChannel('channel-2', mockWindow2 as unknown as Window)

      const handler1 = jest.fn()
      const handler2 = jest.fn()

      channel1.on(handler1)
      channel2.on(handler2)

      // Connect channel1
      channel1.connect()

      expect(handler1).toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()

      // Clear
      handler1.mockClear()
      handler2.mockClear()

      // Connect channel2
      channel2.connect()

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
    })

    it('handles unsubscribe for specific channels', () => {
      const broker = createBroker({
        name: 'multi-broker',
        contract: testContract,
        settings: { debug: false },
      })

      const channel1 = broker.addChannel('channel-1', mockWindow1 as unknown as Window)
      const channel2 = broker.addChannel('channel-2', mockWindow2 as unknown as Window)

      const handler1 = jest.fn()
      const handler2 = jest.fn()

      const unsubscribe1 = channel1.on(handler1)
      channel2.on(handler2)

      // Unsubscribe from channel1
      unsubscribe1()

      // Connect both
      channel1.connect()
      channel2.connect()

      // Only handler2 should be called
      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
    })
  })

  describe('Concurrent Operations', () => {
    it('handles concurrent connects', () => {
      const broker = createBroker({
        name: 'multi-broker',
        contract: testContract,
        settings: { debug: false },
      })

      const channel1 = broker.addChannel('channel-1', mockWindow1 as unknown as Window)
      const channel2 = broker.addChannel('channel-2', mockWindow2 as unknown as Window)
      const channel3 = broker.addChannel('channel-3', mockWindow3 as unknown as Window)

      // Connect all at once
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
        settings: { debug: false },
      })

      const channel1 = broker.addChannel('channel-1', mockWindow1 as unknown as Window)
      const channel2 = broker.addChannel('channel-2', mockWindow2 as unknown as Window)
      const channel3 = broker.addChannel('channel-3', mockWindow3 as unknown as Window)

      channel1.connect()
      channel2.connect()
      channel3.connect()

      // Clear connection messages
      mockWindow1.postMessage.mockClear()
      mockWindow2.postMessage.mockClear()
      mockWindow3.postMessage.mockClear()

      // Send messages concurrently
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
        settings: { debug: false },
      })

      const channel1 = broker.addChannel('channel-1', mockWindow1 as unknown as Window)
      const channel2 = broker.addChannel('channel-2', mockWindow2 as unknown as Window)
      const channel3 = broker.addChannel('channel-3', mockWindow3 as unknown as Window)

      channel1.connect()
      channel2.connect()
      channel3.connect()

      // Disconnect all at once
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
        settings: { debug: false },
      })

      const channel1 = broker.addChannel('channel-1', mockWindow1 as unknown as Window)
      const channel2 = broker.addChannel('channel-2', mockWindow2 as unknown as Window)
      const channel3 = broker.addChannel('channel-3', mockWindow3 as unknown as Window)

      // Channel1: connected
      channel1.connect()

      // Channel2: never connected

      // Channel3: connected then disconnected
      channel3.connect()
      channel3.disconnect()

      expect(channel1.isActive()).toBe(true)
      expect(channel2.isActive()).toBe(false)
      expect(channel3.isActive()).toBe(false)

      // Clear postMessage calls from connect/disconnect
      mockWindow1.postMessage.mockClear()
      mockWindow2.postMessage.mockClear()
      mockWindow3.postMessage.mockClear()

      // Send messages
      channel1.send('BROADCAST', { id: 1 })
      channel2.send('BROADCAST', { id: 2 })
      channel3.send('BROADCAST', { id: 3 })

      // Only channel1 should send immediately
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
        settings: { debug: false },
      })

      const channelCount = 100
      const channels: ReturnType<typeof broker.addChannel>[] = []

      // Create many channels
      for (let i = 0; i < channelCount; i++) {
        const mockWin = createMockWindow()
        const channel = broker.addChannel(`channel-${i}`, mockWin as unknown as Window)
        channels.push(channel)
      }

      expect(broker.channels).toHaveLength(channelCount)

      // Connect all
      channels.forEach((ch) => ch.connect())

      // Verify all connected
      channels.forEach((ch) => {
        expect(ch.isActive()).toBe(true)
      })
    })
  })
})
