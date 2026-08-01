import type { MockWindow } from './test-utils'
import { createBroker } from '../broker/factory'
import { createMockWindow, linkMockWindows, createContractPair } from './test-utils'

describe('Integration: Heartbeat', () => {
  let windowA: MockWindow
  let windowB: MockWindow

  beforeAll(() => {
    jest.useFakeTimers()
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  beforeEach(() => {
    windowA = createMockWindow()
    windowB = createMockWindow()

    linkMockWindows(windowA, windowB, 'http://host-a.com', 'http://host-b.com')
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.clearAllMocks()
  })

  // note: side A emits heartbeat pings and data frames; side B answers with pongs and acks.
  const { contractA, contractB } = createContractPair(['PING', 'DATA'], ['PONG', 'ACK'])

  const setupPair = () => {
    const brokerA = createBroker({ name: 'heartbeat-broker-a', contract: contractA, window: <Window>(<unknown>windowA) })
    const brokerB = createBroker({ name: 'heartbeat-broker-b', contract: contractB, window: <Window>(<unknown>windowB) })
    return {
      channelA: brokerA.addChannel('to-b', <Window>(<unknown>windowB)),
      channelB: brokerB.addChannel('to-a', <Window>(<unknown>windowA)),
    }
  }

  describe('Ping-Pong Pattern', () => {
    it('delivers periodic ping messages to the counterpart', () => {
      const { channelA, channelB } = setupPair()
      channelA.connect()
      channelB.connect()

      const pings: unknown[] = []
      channelB.onMessage((message) => {
        if (message.type === 'PING') {
          pings.push(message)
        }
      })

      const interval = setInterval(() => channelA.send('PING', { seq: pings.length }), 100)
      jest.advanceTimersByTime(300)
      clearInterval(interval)

      expect(pings).toHaveLength(3)
    })

    it('completes a ping-pong round trip between the paired channels', () => {
      const { channelA, channelB } = setupPair()
      channelA.connect()
      channelB.connect()

      channelB.onMessage((message) => {
        if (message.type === 'PING') {
          channelB.send('PONG', { echoed: message.data })
        }
      })

      // note: send() also notifies the sender's own subscribers, so filter to
      const pongs: unknown[] = []
      channelA.onMessage((message) => {
        if (message.type === 'PONG') {
          pongs.push(message)
        }
      })

      channelA.send('PING', { timestamp: 123 })

      expect(pongs).toEqual([expect.objectContaining({ type: 'PONG', data: { echoed: { timestamp: 123 } } })])
    })
  })

  describe('Connection Health Monitoring', () => {
    it('reports active only after both sides complete the handshake', () => {
      const { channelA, channelB } = setupPair()

      const beforeConnect = channelA.isActive()
      channelA.connect()
      const afterLocalConnect = channelA.isActive()
      channelB.connect()

      expect({
        beforeConnect,
        afterLocalConnect,
        afterHandshake: [channelA.isActive(), channelB.isActive()],
      }).toEqual({
        beforeConnect: false,
        afterLocalConnect: false,
        afterHandshake: [true, true],
      })
    })

    it('records the connect timestamp once the handshake completes', () => {
      const { channelA, channelB } = setupPair()

      const beforeConnect = channelA.toJSON().connectTimestamp
      channelA.connect()
      channelB.connect()

      expect({ beforeConnect, afterHandshake: channelA.toJSON().connectTimestamp }).toEqual({
        beforeConnect: null,
        afterHandshake: expect.any(Number),
      })
    })

    it('fires timeout when the counterpart never answers within the deadline', () => {
      const { channelA } = setupPair()

      const timeoutHandler = jest.fn()
      channelA.on('connect-timeout', timeoutHandler)

      channelA.connect()
      jest.advanceTimersByTime(10_000)

      expect(timeoutHandler).toHaveBeenCalledWith({ elapsedMs: 10_000 }, expect.objectContaining({ active: false }))
    })
  })

  describe('Reconnection Scenarios', () => {
    it('reactivates both sides when one side reconnects after disconnect', () => {
      const { channelA, channelB } = setupPair()
      channelA.connect()
      channelB.connect()

      const afterHandshake = [channelA.isActive(), channelB.isActive()]
      channelA.disconnect()
      const afterDisconnect = [channelA.isActive(), channelB.isActive()]
      channelA.connect()
      const afterReconnect = [channelA.isActive(), channelB.isActive()]

      expect({ afterHandshake, afterDisconnect, afterReconnect }).toEqual({
        afterHandshake: [true, true],
        afterDisconnect: [false, false],
        afterReconnect: [true, true],
      })
    })

    it('survives multiple reconnection cycles', () => {
      const { channelA, channelB } = setupPair()
      channelB.connect()
      channelA.connect()

      const cycles: boolean[][] = []
      for (let i = 0; i < 5; i++) {
        channelA.disconnect()
        const whileDisconnected = [channelA.isActive(), channelB.isActive()]
        channelA.connect()
        cycles.push([...whileDisconnected, channelA.isActive(), channelB.isActive()])
      }

      expect(cycles).toEqual(new Array(5).fill([false, false, true, true]))
    })

    it('maintains channel identity across reconnections', () => {
      const { channelA, channelB } = setupPair()
      const originalId = channelA.getId()
      const originalName = channelA.getName()

      channelA.connect()
      channelB.connect()
      channelA.disconnect()
      channelA.connect()

      expect({ id: channelA.getId(), name: channelA.getName() }).toEqual({ id: originalId, name: originalName })
    })
  })

  describe('Message Queuing During Reconnection', () => {
    it('queues messages while disconnected', () => {
      const { channelA, channelB } = setupPair()
      channelA.connect()
      channelB.connect()
      channelA.disconnect()

      channelA.send('DATA', { message: 'queued-1' })
      channelA.send('DATA', { message: 'queued-2' })

      expect(channelA.toJSON().queuedMessagesCount).toBe(2)
    })

    it('flushes queued messages to the counterpart on reconnect', () => {
      const { channelA, channelB } = setupPair()
      channelA.connect()
      channelB.connect()
      channelA.disconnect()

      channelA.send('DATA', { message: 'queued-1' })
      channelA.send('DATA', { message: 'queued-2' })

      const received: unknown[] = []
      channelB.onMessage((message) => received.push(message))

      channelA.connect()

      expect(received).toEqual([
        expect.objectContaining({ type: 'DATA', data: { message: 'queued-1' } }),
        expect.objectContaining({ type: 'DATA', data: { message: 'queued-2' } }),
      ])
    })
  })

  describe('Connection State Events', () => {
    it('fires open with the peer origin and contract when the handshake completes', () => {
      const { channelA, channelB } = setupPair()

      const openHandler = jest.fn()
      channelA.on('open', openHandler)

      channelA.connect()
      channelB.connect()

      expect(openHandler).toHaveBeenCalledWith(
        expect.objectContaining({ origin: 'http://host-b.com', contract: contractB }),
        expect.objectContaining({ active: true })
      )
    })

    it('fires close on both sides when one side disconnects', () => {
      const { channelA, channelB } = setupPair()

      const closeHandlerA = jest.fn()
      const closeHandlerB = jest.fn()
      channelA.on('close', closeHandlerA)
      channelB.on('close', closeHandlerB)

      channelA.connect()
      channelB.connect()
      channelA.disconnect()

      expect([closeHandlerA.mock.calls.length > 0, closeHandlerB.mock.calls.length > 0]).toEqual([true, true])
    })
  })
})
