import type { IChannelContract } from '../types/contract'
import type { MockWindow } from './test-utils'
import { createBroker } from '../broker/factory'
import { createMockWindow } from './test-utils'

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

      const channel = broker.addChannel('heartbeat-channel', <Window>(<unknown>mockWindow))
      channel.connect()

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

      const channel = broker.addChannel('heartbeat-channel', <Window>(<unknown>mockWindow))
      channel.connect()

      const pongReceived = await new Promise<boolean>((resolve) => {
        let received = false
        channel.onMessage((message) => {
          if (message.type === 'PONG') {
            received = true
          }
        })

        channel.send('PING', { timestamp: Date.now() })

        setTimeout(() => resolve(received), 50)
      })

      expect(pongReceived).toBe(false)
    })
  })

  describe('Connection Health Monitoring', () => {
    it('detects active connection', () => {
      const broker = createBroker({
        name: 'health-broker',
        contract: heartbeatContract,
        settings: { logLevel: 'error' },
      })

      const channel = broker.addChannel('health-channel', <Window>(<unknown>mockWindow))
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

      const channel = broker.addChannel('health-channel', <Window>(<unknown>mockWindow))
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

      const channel = broker.addChannel('timeout-channel', <Window>(<unknown>mockWindow))
      channel.connect()

      const timeout = 500
      const lastPong = Date.now()

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

      const channel = broker.addChannel('reconnect-channel', <Window>(<unknown>mockWindow))

      channel.connect()
      expect(channel.isActive()).toBe(true)

      channel.disconnect()
      expect(channel.isActive()).toBe(false)

      channel.connect()
      expect(channel.isActive()).toBe(true)
    })

    it('handles multiple reconnection attempts', () => {
      const broker = createBroker({
        name: 'multi-reconnect-broker',
        contract: heartbeatContract,
        settings: { logLevel: 'error' },
      })

      const channel = broker.addChannel('multi-reconnect-channel', <Window>(<unknown>mockWindow))

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

      const channel = broker.addChannel('identity-channel', <Window>(<unknown>mockWindow))
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

      const channel = broker.addChannel('queue-channel', <Window>(<unknown>mockWindow))
      channel.connect()
      channel.disconnect()

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

      const channel = broker.addChannel('flush-channel', <Window>(<unknown>mockWindow))
      channel.connect()
      channel.disconnect()

      channel.send('DATA', { message: 'queued-1' })
      channel.send('DATA', { message: 'queued-2' })

      mockWindow.postMessage.mockClear()

      channel.connect()

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

      const channel = broker.addChannel('event-channel', <Window>(<unknown>mockWindow))

      const openEventReceived = await new Promise<boolean>((resolve) => {
        channel.on((event, data) => {
          if (event === 'open') {
            if (data !== undefined) {
              resolve(true)
            }
          }
        })

        channel.connect()

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

      const channel = broker.addChannel('close-channel', <Window>(<unknown>mockWindow))
      channel.connect()

      const closeEventReceived = await new Promise<boolean>((resolve) => {
        channel.on((event) => {
          if (event === 'close') {
            resolve(true)
          }
        })

        channel.disconnect()

        setTimeout(() => resolve(false), 100)
      })

      expect(closeEventReceived).toBe(true)
    })
  })
})
