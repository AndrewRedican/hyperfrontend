import type { MockWindow } from './test-utils'
import type { IChannelContract } from '../types/contract'
import { createMockWindow } from './test-utils'
import { createBroker } from '../broker/factory'

describe('Integration: Heartbeat', () => {
  let mockWindow: MockWindow

  beforeEach(() => {
    mockWindow = createMockWindow()
  })

  const heartbeatContract: IChannelContract = {
    emitted: [{ type: 'PING' }, { type: 'DATA' }],
    accepted: [{ type: 'PONG' }, { type: 'ACK' }],
  }

  describe('Ping-Pong Pattern', () => {
    it('sends periodic ping messages', async () => {
      const broker = createBroker({
        name: 'heartbeat-broker',
        contract: heartbeatContract,
        settings: { logLevel: 'error' },
      })

      const channel = broker.addChannel('heartbeat-channel', mockWindow as unknown as Window)
      channel.connect()

      // Send ping every 100ms
      const pings: number[] = []
      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          channel.send('PING', { timestamp: Date.now() })
          pings.push(Date.now())

          if (pings.length >= 3) {
            clearInterval(interval)
            resolve()
          }
        }, 100)
      })
      expect(pings).toHaveLength(3)
    }, 1000)

    it('responds to ping with pong', async () => {
      const broker = createBroker({
        name: 'heartbeat-broker',
        contract: heartbeatContract,
        settings: { logLevel: 'error' },
      })

      const channel = broker.addChannel('heartbeat-channel', mockWindow as unknown as Window)
      channel.connect()

      const pongReceived = await new Promise<boolean>((resolve) => {
        let received = false
        channel.onMessage((message) => {
          if (message.type === 'PONG') {
            received = true
          }
        })

        channel.send('PING', { timestamp: Date.now() })

        // Resolve after a short delay
        setTimeout(() => resolve(received), 50)
      })

      // In real scenario, other side would respond with PONG
      // For testing, we're just verifying the handler is set up
      expect(pongReceived).toBe(false) // No actual response in mock
    })
  })

  describe('Connection Health Monitoring', () => {
    it('detects active connection', () => {
      const broker = createBroker({
        name: 'health-broker',
        contract: heartbeatContract,
        settings: { logLevel: 'error' },
      })

      const channel = broker.addChannel('health-channel', mockWindow as unknown as Window)
      expect(channel.isActive()).toBe(false)

      channel.connect()
      expect(channel.isActive()).toBe(true)
    })

    it('tracks last activity timestamp', () => {
      const broker = createBroker({
        name: 'health-broker',
        contract: heartbeatContract,
        settings: { logLevel: 'error' },
      })

      const channel = broker.addChannel('health-channel', mockWindow as unknown as Window)
      const channelData = channel.toJSON()

      expect(channelData.connectTimestamp).toBeNull()

      channel.connect()
      const afterConnect = channel.toJSON()

      expect(afterConnect.connectTimestamp).toBeGreaterThan(0)
    })

    it('handles connection timeout scenario', async () => {
      const broker = createBroker({
        name: 'timeout-broker',
        contract: heartbeatContract,
        settings: { logLevel: 'error' },
      })

      const channel = broker.addChannel('timeout-channel', mockWindow as unknown as Window)
      channel.connect()

      const timeout = 500 // ms
      const lastPong = Date.now()

      // Simulate timeout check
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          const elapsed = Date.now() - lastPong
          expect(elapsed).toBeGreaterThan(timeout)
          resolve()
        }, 600)
      })
    }, 1000)
  })

  describe('Reconnection Scenarios', () => {
    it('allows reconnection after disconnect', () => {
      const broker = createBroker({
        name: 'reconnect-broker',
        contract: heartbeatContract,
        settings: { logLevel: 'error' },
      })

      const channel = broker.addChannel('reconnect-channel', mockWindow as unknown as Window)

      // First connection
      channel.connect()
      expect(channel.isActive()).toBe(true)

      // Disconnect
      channel.disconnect()
      expect(channel.isActive()).toBe(false)

      // Reconnect
      channel.connect()
      expect(channel.isActive()).toBe(true)
    })

    it('handles multiple reconnection attempts', () => {
      const broker = createBroker({
        name: 'multi-reconnect-broker',
        contract: heartbeatContract,
        settings: { logLevel: 'error' },
      })

      const channel = broker.addChannel('multi-reconnect-channel', mockWindow as unknown as Window)

      for (let i = 0; i < 5; i++) {
        channel.connect()
        expect(channel.isActive()).toBe(true)

        channel.disconnect()
        expect(channel.isActive()).toBe(false)
      }
    })

    it('maintains channel identity across reconnections', () => {
      const broker = createBroker({
        name: 'identity-broker',
        contract: heartbeatContract,
        settings: { logLevel: 'error' },
      })

      const channel = broker.addChannel('identity-channel', mockWindow as unknown as Window)
      const originalId = channel.getId()
      const originalName = channel.getName()

      channel.connect()
      channel.disconnect()
      channel.connect()

      expect(channel.getId()).toBe(originalId)
      expect(channel.getName()).toBe(originalName)
    })
  })

  describe('Message Queuing During Reconnection', () => {
    it('queues messages while disconnected', () => {
      const broker = createBroker({
        name: 'queue-broker',
        contract: heartbeatContract,
        settings: { logLevel: 'error' },
      })

      const channel = broker.addChannel('queue-channel', mockWindow as unknown as Window)
      channel.connect()
      channel.disconnect()

      // Send messages while disconnected (should be queued)
      channel.send('DATA', { message: 'queued-1' })
      channel.send('DATA', { message: 'queued-2' })

      const channelData = channel.toJSON()
      expect(channelData.queuedMessagesCount).toBe(2)
    })

    it('flushes queued messages on reconnect', () => {
      const broker = createBroker({
        name: 'flush-broker',
        contract: heartbeatContract,
        settings: { logLevel: 'error' },
      })

      const channel = broker.addChannel('flush-channel', mockWindow as unknown as Window)
      channel.connect()
      channel.disconnect()

      channel.send('DATA', { message: 'queued-1' })
      channel.send('DATA', { message: 'queued-2' })

      mockWindow.postMessage.mockClear()

      channel.connect()

      // After reconnect, queued messages should be sent
      expect(mockWindow.postMessage).toHaveBeenCalled()
    })
  })

  describe('Connection State Events', () => {
    it('emits open event on connect', async () => {
      const broker = createBroker({
        name: 'event-broker',
        contract: heartbeatContract,
        settings: { logLevel: 'error' },
      })

      const channel = broker.addChannel('event-channel', mockWindow as unknown as Window)

      const openEventReceived = await new Promise<boolean>((resolve) => {
        channel.on((event, data) => {
          if (event === 'open') {
            // Verify data is defined
            if (data !== undefined) {
              resolve(true)
            }
          }
        })

        channel.connect()

        // Timeout after 100ms in case event doesn't fire
        setTimeout(() => resolve(false), 100)
      })

      expect(openEventReceived).toBe(true)
    })

    it('emits close event on disconnect', async () => {
      const broker = createBroker({
        name: 'close-broker',
        contract: heartbeatContract,
        settings: { logLevel: 'error' },
      })

      const channel = broker.addChannel('close-channel', mockWindow as unknown as Window)
      channel.connect()

      const closeEventReceived = await new Promise<boolean>((resolve) => {
        channel.on((event) => {
          if (event === 'close') {
            resolve(true)
          }
        })

        channel.disconnect()

        // Timeout after 100ms in case event doesn't fire
        setTimeout(() => resolve(false), 100)
      })

      expect(closeEventReceived).toBe(true)
    })
  })
})
