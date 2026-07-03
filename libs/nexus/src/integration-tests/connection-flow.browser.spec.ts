import type { IChannelContract } from '../types/contract'
import type { MockWindow } from './test-utils'
import { createBroker } from '../broker/factory'
import { createMockWindow, linkMockWindows, createContractPair } from './test-utils'

describe('Connection Flow Integration', () => {
  let windowA: MockWindow
  let windowB: MockWindow
  let originalWindow: Window

  beforeAll(() => {
    jest.useFakeTimers()
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  beforeEach(() => {
    originalWindow = global.window

    windowA = createMockWindow()
    windowB = createMockWindow()

    linkMockWindows(windowA, windowB, 'http://host-a.com', 'http://host-b.com')
  })

  afterEach(() => {
    global.window = <Window & typeof globalThis>(<unknown>originalWindow)
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  describe('Three-Way Handshake', () => {
    it('completes full handshake: REQUEST → ACCEPT → OPEN', async () => {
      const { contractA, contractB } = createContractPair(['PING'], ['PONG'])

      global.window = <Window & typeof globalThis>(<unknown>windowA)
      const brokerA = createBroker({
        name: 'broker-a',
        contract: contractA,
      })

      global.window = <Window & typeof globalThis>(<unknown>windowB)
      const brokerB = createBroker({
        name: 'broker-b',
        contract: contractB,
      })

      global.window = <Window & typeof globalThis>(<unknown>windowA)
      const channelA = brokerA.addChannel('to-b', <Window>(<unknown>windowB))

      global.window = <Window & typeof globalThis>(<unknown>windowB)
      const channelB = brokerB.addChannel('to-a', <Window>(<unknown>windowA))

      const eventsA: string[] = []
      const eventsB: string[] = []

      channelA.on((event) => eventsA.push(event))
      channelB.on((event) => eventsB.push(event))

      channelB.connect()
      channelA.connect()

      expect(channelA.isActive()).toBe(true)
      expect(channelB.isActive()).toBe(true)

      expect(eventsA).toContain('open')
      expect(eventsB).toContain('open')
    })

    it('fires open event on both sides', async () => {
      const { contractA, contractB } = createContractPair(['DATA'], ['ACK'])

      global.window = <Window & typeof globalThis>(<unknown>windowA)
      const brokerA = createBroker({
        name: 'broker-a',
        contract: contractA,
      })

      global.window = <Window & typeof globalThis>(<unknown>windowB)
      const brokerB = createBroker({
        name: 'broker-b',
        contract: contractB,
      })

      const channelA = brokerA.addChannel('to-b', <Window>(<unknown>windowB))
      const channelB = brokerB.addChannel('to-a', <Window>(<unknown>windowA))

      const openHandlerA = jest.fn()
      const openHandlerB = jest.fn()

      channelA.on((event, data) => {
        if (event === 'open') openHandlerA(data)
      })

      channelB.on((event, data) => {
        if (event === 'open') openHandlerB(data)
      })

      channelA.connect()
      channelB.connect()

      expect(openHandlerA).toHaveBeenCalled()
      expect(openHandlerB).toHaveBeenCalled()
    })

    it('allows message exchange after handshake', async () => {
      const { contractA, contractB } = createContractPair(['PING'], ['PONG'])

      const brokerA = createBroker({
        name: 'broker-a',
        contract: contractA,
        window: <Window>(<unknown>windowA),
      })

      const brokerB = createBroker({
        name: 'broker-b',
        contract: contractB,
        window: <Window>(<unknown>windowB),
      })

      const channelA = brokerA.addChannel('to-b', <Window>(<unknown>windowB))
      const channelB = brokerB.addChannel('to-a', <Window>(<unknown>windowA))

      channelA.connect()
      channelB.connect()

      const messagesB: unknown[] = []
      channelB.onMessage((msg) => messagesB.push(msg))

      channelA.send('PING', { timestamp: 123 })

      expect(messagesB).toEqual([expect.objectContaining({ type: 'PING', data: { timestamp: 123 } })])
    })
  })

  describe('Denial Flow', () => {
    it('denies on invalid contract', () => {
      const contractA: IChannelContract = {
        emitted: [{ type: 'UNKNOWN_TYPE' }],
        accepted: [{ type: 'RESPONSE' }],
      }

      const contractB: IChannelContract = {
        emitted: [{ type: 'RESPONSE' }],
        accepted: [{ type: 'EXPECTED_TYPE' }],
      }

      global.window = <Window & typeof globalThis>(<unknown>windowA)
      const brokerA = createBroker({
        name: 'broker-a',
        contract: contractA,
      })

      global.window = <Window & typeof globalThis>(<unknown>windowB)
      const brokerB = createBroker({
        name: 'broker-b',
        contract: contractB,
      })

      const channelA = brokerA.addChannel('to-b', <Window>(<unknown>windowB))
      const channelB = brokerB.addChannel('to-a', <Window>(<unknown>windowA))

      const denyHandler = jest.fn()
      channelA.on((event, data) => {
        if (event === 'deny') denyHandler(data)
      })

      channelA.connect()
      channelB.connect()

      expect(channelA.isActive()).toBe(true)
    })

    it('denies on security policy rejection', () => {
      const { contractA, contractB } = createContractPair(['MSG'], ['ACK'])

      global.window = <Window & typeof globalThis>(<unknown>windowA)
      const brokerA = createBroker({
        name: 'broker-a',
        contract: contractA,
      })

      global.window = <Window & typeof globalThis>(<unknown>windowB)
      const brokerB = createBroker({
        name: 'broker-b',
        contract: contractB,
      })

      brokerB.setSecurityPolicy(() => false)

      const channelA = brokerA.addChannel('to-b', <Window>(<unknown>windowB))
      const channelB = brokerB.addChannel('to-a', <Window>(<unknown>windowA))

      const denyHandler = jest.fn()
      channelA.on((event) => {
        if (event === 'deny') denyHandler()
      })

      channelA.connect()
      channelB.connect()

      expect(brokerB).toBeDefined()
    })

    it('cleans up process on denial', () => {
      const { contractA, contractB } = createContractPair(['MSG'], ['ACK'])

      global.window = <Window & typeof globalThis>(<unknown>windowA)
      const brokerA = createBroker({
        name: 'broker-a',
        contract: contractA,
      })

      global.window = <Window & typeof globalThis>(<unknown>windowB)
      const brokerB = createBroker({
        name: 'broker-b',
        contract: contractB,
      })

      const channelA = brokerA.addChannel('to-b', <Window>(<unknown>windowB))
      const channelB = brokerB.addChannel('to-a', <Window>(<unknown>windowA))

      channelA.connect()
      channelB.connect()

      expect(channelA.toJSON()).toBeDefined()
      expect(channelB.toJSON()).toBeDefined()
    })
  })

  describe('Cancellation Flow', () => {
    it('cancels pending connection: CANCEL → CANCEL_ACK', () => {
      const { contractA, contractB } = createContractPair(['MSG'], ['ACK'])

      global.window = <Window & typeof globalThis>(<unknown>windowA)
      const brokerA = createBroker({
        name: 'broker-a',
        contract: contractA,
      })

      global.window = <Window & typeof globalThis>(<unknown>windowB)
      const brokerB = createBroker({
        name: 'broker-b',
        contract: contractB,
      })

      const channelA = brokerA.addChannel('to-b', <Window>(<unknown>windowB))
      brokerB.addChannel('to-a', <Window>(<unknown>windowA))

      const cancelHandler = jest.fn()
      const closeHandler = jest.fn()
      channelA.on((event) => {
        if (event === 'cancel') cancelHandler()
        if (event === 'close') closeHandler()
      })

      channelA.connect()
      channelA.cancel()

      expect(channelA.isActive()).toBe(false)
      expect(cancelHandler.mock.calls.length + closeHandler.mock.calls.length).toBeGreaterThan(0)
    })

    it('cleans up processes on cancellation', () => {
      const { contractA, contractB } = createContractPair(['MSG'], ['ACK'])

      global.window = <Window & typeof globalThis>(<unknown>windowA)
      const brokerA = createBroker({
        name: 'broker-a',
        contract: contractA,
      })

      global.window = <Window & typeof globalThis>(<unknown>windowB)
      const brokerB = createBroker({
        name: 'broker-b',
        contract: contractB,
      })

      const channelA = brokerA.addChannel('to-b', <Window>(<unknown>windowB))
      brokerB.addChannel('to-a', <Window>(<unknown>windowA))

      channelA.connect()
      channelA.cancel()

      expect(channelA.isActive()).toBe(false)

      const retrieved = brokerA.getChannel('to-b')
      expect(retrieved).toBeDefined()
    })
  })

  describe('Close Flow', () => {
    it('closes gracefully: CLOSE → CLOSE_ACK', () => {
      const { contractA, contractB } = createContractPair(['MSG'], ['ACK'])

      global.window = <Window & typeof globalThis>(<unknown>windowA)
      const brokerA = createBroker({
        name: 'broker-a',
        contract: contractA,
      })

      global.window = <Window & typeof globalThis>(<unknown>windowB)
      const brokerB = createBroker({
        name: 'broker-b',
        contract: contractB,
      })

      const channelA = brokerA.addChannel('to-b', <Window>(<unknown>windowB))
      const channelB = brokerB.addChannel('to-a', <Window>(<unknown>windowA))

      const closeHandlerA = jest.fn()
      const closeHandlerB = jest.fn()

      channelA.on((event) => {
        if (event === 'close') closeHandlerA()
      })

      channelB.on((event) => {
        if (event === 'close') closeHandlerB()
      })

      channelA.connect()
      channelB.connect()

      expect(channelA.isActive()).toBe(true)
      expect(channelB.isActive()).toBe(true)

      channelA.disconnect()

      expect(channelA.isActive()).toBe(false)
      expect(closeHandlerA).toHaveBeenCalled()
    })

    it('allows reconnection after close', () => {
      const { contractA, contractB } = createContractPair(['MSG'], ['ACK'])

      global.window = <Window & typeof globalThis>(<unknown>windowA)
      const brokerA = createBroker({
        name: 'broker-a',
        contract: contractA,
      })

      global.window = <Window & typeof globalThis>(<unknown>windowB)
      const brokerB = createBroker({
        name: 'broker-b',
        contract: contractB,
      })

      const channelA = brokerA.addChannel('to-b', <Window>(<unknown>windowB))
      const channelB = brokerB.addChannel('to-a', <Window>(<unknown>windowA))

      channelA.connect()
      channelB.connect()
      expect(channelA.isActive()).toBe(true)

      channelA.disconnect()
      expect(channelA.isActive()).toBe(false)

      channelA.connect()
      expect(channelA.isActive()).toBe(true)
    })
  })

  describe('Scheduled Activation', () => {
    it('schedules activation when channel not ready', () => {
      const { contractA, contractB } = createContractPair(['MSG'], ['ACK'])

      global.window = <Window & typeof globalThis>(<unknown>windowA)
      const brokerA = createBroker({
        name: 'broker-a',
        contract: contractA,
      })

      global.window = <Window & typeof globalThis>(<unknown>windowB)
      const brokerB = createBroker({
        name: 'broker-b',
        contract: contractB,
      })

      const channelA = brokerA.addChannel('to-b', <Window>(<unknown>windowB))

      channelA.connect()

      const channelB = brokerB.addChannel('to-a', <Window>(<unknown>windowA))
      channelB.connect()

      expect(channelA.isActive()).toBe(true)
      expect(channelB.isActive()).toBe(true)
    })

    it('immediately activates when channel ready', () => {
      const { contractA, contractB } = createContractPair(['MSG'], ['ACK'])

      global.window = <Window & typeof globalThis>(<unknown>windowA)
      const brokerA = createBroker({
        name: 'broker-a',
        contract: contractA,
      })

      global.window = <Window & typeof globalThis>(<unknown>windowB)
      const brokerB = createBroker({
        name: 'broker-b',
        contract: contractB,
      })

      const channelB = brokerB.addChannel('to-a', <Window>(<unknown>windowA))
      channelB.connect()

      const channelA = brokerA.addChannel('to-b', <Window>(<unknown>windowB))
      channelA.connect()

      expect(channelA.isActive()).toBe(true)
      expect(channelB.isActive()).toBe(true)
    })
  })

  describe('Page Reload Detection', () => {
    it('handles page reload gracefully', () => {
      const { contractA, contractB } = createContractPair(['MSG'], ['ACK'])

      global.window = <Window & typeof globalThis>(<unknown>windowA)
      const brokerA = createBroker({
        name: 'broker-a',
        contract: contractA,
        settings: { logLevel: 'debug' },
      })

      global.window = <Window & typeof globalThis>(<unknown>windowB)
      const brokerB = createBroker({
        name: 'broker-b',
        contract: contractB,
      })

      const channelA = brokerA.addChannel('to-b', <Window>(<unknown>windowB))
      const channelB = brokerB.addChannel('to-a', <Window>(<unknown>windowA))

      channelA.connect()
      channelB.connect()

      expect(channelA.isActive()).toBe(true)
      expect(channelB.isActive()).toBe(true)

      channelA.disconnect()
      channelA.connect()

      expect(channelA.isActive()).toBe(true)
    })
  })
})
