import type { MockWindow } from './test-utils'
import { after as afterAll, afterEach, before as beforeAll } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createBroker } from '../broker/factory'
import { createMockWindow, createContractPair } from './test-utils'

const MAIN_ORIGIN = 'http://main-host.com'

describe('Integration: Multi-Channel', () => {
  beforeAll(() => {
    jest.useFakeTimers()
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.clearAllMocks()
  })

  // note: the main broker has ONE contract shared by all of its channels, so
  const { contractA: mainContract, contractB: counterpartContract } = createContractPair(
    ['BROADCAST', 'DIRECT_MESSAGE'],
    ['ACK', 'RESPONSE']
  )

  // how: the main broker listens on one shared window while each of its
  const wireCounterpart = (mainWindow: MockWindow, counterpartWindow: MockWindow, counterpartOrigin: string): MockWindow => {
    const mainProxy = createMockWindow()
    counterpartWindow.postMessage.mockImplementation((data: unknown) => {
      counterpartWindow._dispatchMessage(
        new MessageEvent('message', {
          data,
          origin: MAIN_ORIGIN,
          source: mainProxy as unknown as Window,
        })
      )
    })
    mainProxy.postMessage.mockImplementation((data: unknown) => {
      mainWindow._dispatchMessage(
        new MessageEvent('message', {
          data,
          origin: counterpartOrigin,
          source: counterpartWindow as unknown as Window,
        })
      )
    })
    return mainProxy
  }

  const buildPair = (mainWindow: MockWindow, mainBroker: ReturnType<typeof createBroker>, index: number) => {
    const counterpartWindow = createMockWindow()
    const mainProxy = wireCounterpart(mainWindow, counterpartWindow, `http://counterpart-${index}.com`)
    const counterpartBroker = createBroker({
      name: `counterpart-broker-${index}`,
      contract: counterpartContract,
      window: counterpartWindow as unknown as Window,
      settings: { logLevel: 'error' },
    })
    const counterpartChannel = counterpartBroker.addChannel('to-main', mainProxy as unknown as Window)
    const mainChannel = mainBroker.addChannel(`channel-${index}`, counterpartWindow as unknown as Window)
    return { mainChannel, counterpartChannel, counterpartWindow }
  }

  const setupMultiChannel = (channelCount: number) => {
    const mainWindow = createMockWindow()
    const mainBroker = createBroker({
      name: 'multi-broker',
      contract: mainContract,
      window: mainWindow as unknown as Window,
      settings: { logLevel: 'error' },
    })
    const pairs: ReturnType<typeof buildPair>[] = []
    for (let index = 0; index < channelCount; index++) {
      pairs.push(buildPair(mainWindow, mainBroker, index))
    }
    return { mainBroker, pairs }
  }

  // how: activation requires the wire handshake between BOTH brokers; the main
  const activatePair = (pair: ReturnType<typeof buildPair>): void => {
    pair.mainChannel.connect()
    pair.counterpartChannel.connect()
  }

  describe('Multiple Channel Management', () => {
    it('manages multiple channels independently', () => {
      const { mainBroker, pairs } = setupMultiChannel(3)

      expect({
        names: pairs.map((pair) => pair.mainChannel.name),
        registered: mainBroker.channels.length,
      }).toEqual({
        names: ['channel-0', 'channel-1', 'channel-2'],
        registered: 3,
      })
    })

    it('activates and deactivates channels independently through the handshake', () => {
      const { pairs } = setupMultiChannel(3)

      activatePair(pairs[0])
      activatePair(pairs[2])

      const afterConnect = pairs.map((pair) => pair.mainChannel.isActive())

      pairs[0].mainChannel.disconnect()

      expect({
        afterConnect,
        afterDisconnect: pairs.map((pair) => pair.mainChannel.isActive()),
      }).toEqual({
        afterConnect: [true, false, true],
        afterDisconnect: [false, false, true],
      })
    })
  })

  describe('Message Isolation', () => {
    it('isolates messages between channels', () => {
      const { pairs } = setupMultiChannel(2)

      pairs.forEach(activatePair)
      pairs.forEach((pair) => pair.counterpartWindow.postMessage.mockClear())

      pairs[0].mainChannel.send('BROADCAST', { from: 'channel-0' })

      const afterFirstSend = pairs.map((pair) => pair.counterpartWindow.postMessage.mock.calls.length)

      pairs[1].mainChannel.send('BROADCAST', { from: 'channel-1' })

      expect({
        afterFirstSend,
        afterSecondSend: pairs.map((pair) => pair.counterpartWindow.postMessage.mock.calls.length),
      }).toEqual({
        afterFirstSend: [1, 0],
        afterSecondSend: [1, 1],
      })
    })

    it('maintains separate message queues until each handshake completes', () => {
      const { pairs } = setupMultiChannel(2)

      const received = pairs.map(() => [] as unknown[])
      pairs.forEach((pair, index) => pair.counterpartChannel.onMessage((message) => received[index].push(message)))

      pairs[0].mainChannel.send('BROADCAST', { id: 1 })
      pairs[0].mainChannel.send('BROADCAST', { id: 2 })
      pairs[1].mainChannel.send('BROADCAST', { id: 3 })

      activatePair(pairs[0])

      const afterFirstHandshake = received.map((messages) => messages.length)

      activatePair(pairs[1])

      expect({
        afterFirstHandshake,
        afterSecondHandshake: received.map((messages) => messages.length),
      }).toEqual({
        afterFirstHandshake: [2, 0],
        afterSecondHandshake: [2, 1],
      })
    })
  })

  describe('Event Isolation', () => {
    it('isolates open events between channels', () => {
      const { pairs } = setupMultiChannel(2)

      const openHandlers = pairs.map(() => jest.fn())
      pairs.forEach((pair, index) => pair.mainChannel.on('open', openHandlers[index]))

      activatePair(pairs[0])

      const afterFirstHandshake = openHandlers.map((handler) => handler.mock.calls.length)

      activatePair(pairs[1])

      expect({
        afterFirstHandshake,
        afterSecondHandshake: openHandlers.map((handler) => handler.mock.calls.length),
      }).toEqual({
        afterFirstHandshake: [1, 0],
        afterSecondHandshake: [1, 1],
      })
    })

    it('stops delivering events after a channel-specific unsubscribe', () => {
      const { pairs } = setupMultiChannel(2)

      const unsubscribedHandler = jest.fn()
      const retainedHandler = jest.fn()

      const unsubscribe = pairs[0].mainChannel.on(unsubscribedHandler)
      pairs[1].mainChannel.on(retainedHandler)

      unsubscribe()

      pairs.forEach(activatePair)

      expect({
        unsubscribedCalls: unsubscribedHandler.mock.calls.length,
        retainedFired: retainedHandler.mock.calls.length > 0,
      }).toEqual({
        unsubscribedCalls: 0,
        retainedFired: true,
      })
    })
  })

  describe('Concurrent Operations', () => {
    it('activates every pair when all handshakes run back to back', () => {
      const { pairs } = setupMultiChannel(3)

      // how: all main-side connects fire first so each counterpart holds a
      pairs.forEach((pair) => pair.mainChannel.connect())
      pairs.forEach((pair) => pair.counterpartChannel.connect())

      expect(pairs.map((pair) => [pair.mainChannel.isActive(), pair.counterpartChannel.isActive()])).toEqual([
        [true, true],
        [true, true],
        [true, true],
      ])
    })

    it('delivers concurrent sends to each counterpart exactly once', () => {
      const { pairs } = setupMultiChannel(3)

      pairs.forEach(activatePair)
      pairs.forEach((pair) => pair.counterpartWindow.postMessage.mockClear())

      pairs.forEach((pair, index) => pair.mainChannel.send('BROADCAST', { from: index }))

      expect(pairs.map((pair) => pair.counterpartWindow.postMessage.mock.calls.length)).toEqual([1, 1, 1])
    })

    it('deactivates both sides of every pair on concurrent disconnects', () => {
      const { pairs } = setupMultiChannel(3)

      pairs.forEach(activatePair)
      pairs.forEach((pair) => pair.mainChannel.disconnect())

      expect(pairs.map((pair) => [pair.mainChannel.isActive(), pair.counterpartChannel.isActive()])).toEqual([
        [false, false],
        [false, false],
        [false, false],
      ])
    })
  })

  describe('Channel Lifecycle Mix', () => {
    it('handles mixed lifecycle states across channels', () => {
      const { pairs } = setupMultiChannel(3)

      activatePair(pairs[0])
      activatePair(pairs[2])
      pairs[2].mainChannel.disconnect()

      const states = pairs.map((pair) => pair.mainChannel.isActive())

      pairs.forEach((pair) => pair.counterpartWindow.postMessage.mockClear())
      pairs.forEach((pair, index) => pair.mainChannel.send('BROADCAST', { id: index }))

      expect({
        states,
        delivered: pairs.map((pair) => pair.counterpartWindow.postMessage.mock.calls.length > 0),
      }).toEqual({
        states: [true, false, false],
        delivered: [true, false, false],
      })
    })

    it('re-handshakes a disconnected channel without disturbing the others', () => {
      const { pairs } = setupMultiChannel(2)

      pairs.forEach(activatePair)
      pairs[0].mainChannel.disconnect()

      // note: after a graceful close both sides stay ready, so a single
      pairs[0].mainChannel.connect()

      expect(pairs.map((pair) => [pair.mainChannel.isActive(), pair.counterpartChannel.isActive()])).toEqual([
        [true, true],
        [true, true],
      ])
    })
  })

  describe('Performance', () => {
    it('handles many channels efficiently', () => {
      // note: each channel needs a full counterpart window+broker pair for the
      const channelCount = 20
      const { mainBroker, pairs } = setupMultiChannel(channelCount)

      pairs.forEach(activatePair)

      expect({
        registered: mainBroker.channels.length,
        allActive: pairs.every((pair) => pair.mainChannel.isActive()),
      }).toEqual({
        registered: channelCount,
        allActive: true,
      })
    })
  })
})
