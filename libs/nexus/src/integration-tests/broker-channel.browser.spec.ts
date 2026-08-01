import type { IChannelContract } from '../types/contract'
import type { MockWindow } from './test-utils'
import { createBroker } from '../broker/factory'
import { ACTION_TYPES } from '../types/action'
import { createMockWindow, linkMockWindows, createContractPair } from './test-utils'

describe('Integration: Broker + Channel', () => {
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

  const setupPair = (contractA: IChannelContract, contractB: IChannelContract) => {
    const brokerA = createBroker({ name: 'broker-a', contract: contractA, window: <Window>(<unknown>windowA) })
    const brokerB = createBroker({ name: 'broker-b', contract: contractB, window: <Window>(<unknown>windowB) })
    return {
      brokerA,
      brokerB,
      channelA: brokerA.addChannel('to-b', <Window>(<unknown>windowB)),
      channelB: brokerB.addChannel('to-a', <Window>(<unknown>windowA)),
    }
  }

  const postedTypes = (target: MockWindow) => target.postMessage.mock.calls.map((call) => (<{ type: string }>call[0]).type)

  describe('Basic Communication Flow', () => {
    it('completes the full connection lifecycle across a paired handshake', () => {
      const { contractA, contractB } = createContractPair(['PING'], ['PONG'])
      const { channelA, channelB } = setupPair(contractA, contractB)

      const beforeConnect = [channelA.isActive(), channelB.isActive()]

      channelA.connect()
      channelB.connect()
      const afterHandshake = [channelA.isActive(), channelB.isActive()]

      channelA.disconnect()
      const afterDisconnect = [channelA.isActive(), channelB.isActive()]

      expect({ name: channelA.name, beforeConnect, afterHandshake, afterDisconnect }).toEqual({
        name: 'to-b',
        beforeConnect: [false, false],
        afterHandshake: [true, true],
        afterDisconnect: [false, false],
      })
    })

    it('sends messages to the peer window once the handshake completes', () => {
      const { contractA, contractB } = createContractPair(['PING'], ['PONG'])
      const { channelA, channelB } = setupPair(contractA, contractB)

      channelA.connect()
      channelB.connect()

      windowB.postMessage.mockClear()
      channelA.send('PING', { timestamp: 123 })

      expect(windowB.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: ACTION_TYPES.NEW_MESSAGE }), 'http://host-b.com')
    })

    it('delivers messages to subscribers and stops after unsubscribe', () => {
      const { contractA, contractB } = createContractPair(['PING'], ['PONG'])
      const { channelA, channelB } = setupPair(contractA, contractB)

      const received: unknown[] = []
      const unsubscribe = channelB.onMessage((msg) => received.push(msg))

      channelA.connect()
      channelB.connect()

      channelA.send('PING', { id: 1 })
      unsubscribe()
      channelA.send('PING', { id: 2 })

      expect(received).toEqual([expect.objectContaining({ type: 'PING', data: { id: 1 } })])
    })

    it('fires open with the peer origin and peer contract', () => {
      const { contractA, contractB } = createContractPair(['PING'], ['PONG'])
      const { channelA, channelB } = setupPair(contractA, contractB)

      const eventHandler = jest.fn()
      const unsubscribe = channelA.on('open', eventHandler)

      channelA.connect()
      channelB.connect()
      unsubscribe()

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({ origin: 'http://host-b.com', contract: contractB }),
        expect.objectContaining({ active: true })
      )
    })
  })

  describe('Message Routing', () => {
    it('routes each send as a NEW_MESSAGE frame to the target window', () => {
      const { contractA, contractB } = createContractPair(['PING', 'DATA_REQUEST'], ['PONG'])
      const { channelA, channelB } = setupPair(contractA, contractB)

      channelA.connect()
      channelB.connect()

      windowB.postMessage.mockClear()
      channelA.send('PING', { id: 1 })
      channelA.send('DATA_REQUEST', { query: 'test' })

      expect(postedTypes(windowB)).toEqual([ACTION_TYPES.NEW_MESSAGE, ACTION_TYPES.NEW_MESSAGE])
    })

    it('queues messages while inactive and flushes them after the handshake', () => {
      const { contractA, contractB } = createContractPair(['PING'], ['PONG'])
      const { channelA, channelB } = setupPair(contractA, contractB)

      const received: unknown[] = []
      channelB.onMessage((msg) => received.push(msg))

      channelA.send('PING', { id: 1 })
      const framesWhileInactive = windowB.postMessage.mock.calls.length

      channelA.connect()
      channelB.connect()

      expect({ framesWhileInactive, received }).toEqual({
        framesWhileInactive: 0,
        received: [expect.objectContaining({ type: 'PING', data: { id: 1 } })],
      })
    })
  })

  describe('State Transitions', () => {
    it('exposes peer metadata and own accepted types after activation', () => {
      const { contractA, contractB } = createContractPair(['PING'], ['PONG'])
      const { channelA, channelB } = setupPair(contractA, contractB)

      channelA.connect()
      channelB.connect()

      expect({ json: channelA.toJSON(), acceptedTypes: channelA.getAcceptedTypes() }).toEqual({
        json: expect.objectContaining({ active: true, peerContract: contractB, peerId: expect.any(String) }),
        acceptedTypes: ['PONG'],
      })
    })

    it('survives repeated connect/disconnect cycles with a ready counterpart', () => {
      const { contractA, contractB } = createContractPair(['PING'], ['PONG'])
      const { channelA, channelB } = setupPair(contractA, contractB)

      // note: The counterpart connects once; each later cycle re-handshakes
      // note: from a single connect() because both sides stay ready after CLOSE.
      channelB.connect()

      const cycles: boolean[][] = []
      for (let i = 0; i < 3; i++) {
        channelA.connect()
        cycles.push([channelA.isActive(), channelB.isActive()])

        channelA.disconnect()
        cycles.push([channelA.isActive(), channelB.isActive()])
      }

      expect(cycles).toEqual([
        [true, true],
        [false, false],
        [true, true],
        [false, false],
        [true, true],
        [false, false],
      ])
    })
  })

  describe('Broker Channel Management', () => {
    it('retrieves the same channel by window, name, and id', () => {
      const { contractA } = createContractPair(['PING'], ['PONG'])
      const broker = createBroker({ name: 'broker-a', contract: contractA, window: <Window>(<unknown>windowA) })

      const channel = broker.addChannel('test-channel', <Window>(<unknown>windowB))

      expect({
        byWindow: broker.getChannel(<Window>(<unknown>windowB)) === channel,
        byName: broker.getChannel('test-channel') === channel,
        byId: broker.getChannel(channel.id) === channel,
      }).toEqual({ byWindow: true, byName: true, byId: true })
    })

    it('lists all channels', () => {
      const { contractA } = createContractPair(['PING'], ['PONG'])
      const broker = createBroker({ name: 'broker-a', contract: contractA, window: <Window>(<unknown>windowA) })

      const windowC = createMockWindow()

      broker.addChannel('channel-1', <Window>(<unknown>windowB))
      broker.addChannel('channel-2', <Window>(<unknown>windowC))

      expect(broker.channels).toHaveLength(2)
    })

    it('reuses the existing channel for the same window', () => {
      const { contractA } = createContractPair(['PING'], ['PONG'])
      const broker = createBroker({ name: 'broker-a', contract: contractA, window: <Window>(<unknown>windowA) })

      const channel1 = broker.addChannel('first', <Window>(<unknown>windowB))
      const channel2 = broker.addChannel('second', <Window>(<unknown>windowB))

      expect(channel1).toBe(channel2)
    })
  })

  describe('Error Handling', () => {
    it('rejects message types outside the own emitted contract even while inactive', () => {
      const { contractA, contractB } = createContractPair(['PING'], ['PONG'])
      const { channelA } = setupPair(contractA, contractB)

      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        channelA.send(<any>'INVALID_TYPE', {})
      }).toThrow('not in the emitted actions')
    })

    it('tolerates disconnect of an inactive channel', () => {
      const { contractA, contractB } = createContractPair(['PING'], ['PONG'])
      const { channelA } = setupPair(contractA, contractB)

      expect(() => {
        channelA.disconnect()
      }).not.toThrow()
    })
  })

  describe('Cleanup', () => {
    it('cleans up resources on destroy', () => {
      const { contractA, contractB } = createContractPair(['PING'], ['PONG'])
      const { channelA, channelB } = setupPair(contractA, contractB)

      channelA.connect()
      channelB.connect()

      const eventHandler = jest.fn()
      channelA.on(eventHandler)

      channelA.destroy()

      expect(channelA.isActive()).toBe(false)
    })
  })
})
