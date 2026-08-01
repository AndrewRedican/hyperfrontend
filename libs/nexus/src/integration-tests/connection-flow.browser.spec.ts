import type { IChannelContract } from '../types/contract'
import type { MockWindow } from './test-utils'
import { createBroker } from '../broker/factory'
import { ACTION_TYPES } from '../types/action'
import { createMockWindow, linkMockWindows, simulateMessage, createContractPair } from './test-utils'

describe('Connection Flow Integration', () => {
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

  describe('Three-Way Handshake', () => {
    it('exchanges REQUEST, ACCEPT, and OPEN frames over the wire', () => {
      const { contractA, contractB } = createContractPair(['PING'], ['PONG'])
      const { channelA, channelB } = setupPair(contractA, contractB)

      channelB.connect()
      channelA.connect()

      expect({
        aActive: channelA.isActive(),
        bActive: channelB.isActive(),
        framesToA: postedTypes(windowA),
        framesToB: postedTypes(windowB),
      }).toEqual({
        aActive: true,
        bActive: true,
        framesToA: [ACTION_TYPES.REQUEST_CONNECTION, ACTION_TYPES.OPEN_CONNECTION],
        framesToB: [ACTION_TYPES.ACCEPT_CONNECTION],
      })
    })

    it('fires open on both sides with the peer origin and peer contract', () => {
      const { contractA, contractB } = createContractPair(['PING'], ['PONG'])
      const { channelA, channelB } = setupPair(contractA, contractB)

      const openA = jest.fn()
      const openB = jest.fn()
      channelA.on('open', openA)
      channelB.on('open', openB)

      channelA.connect()
      channelB.connect()

      expect(openA).toHaveBeenCalledWith(
        expect.objectContaining({ origin: 'http://host-b.com', contract: contractB }),
        expect.objectContaining({ active: true })
      )
      expect(openB).toHaveBeenCalledWith(
        expect.objectContaining({ origin: 'http://host-a.com', contract: contractA }),
        expect.objectContaining({ active: true })
      )
    })

    it('activates symmetrically regardless of which side initiates', () => {
      const { contractA, contractB } = createContractPair(['PING'], ['PONG'])
      const first = setupPair(contractA, contractB)
      first.channelA.connect()
      first.channelB.connect()

      const otherWindowA = createMockWindow()
      const otherWindowB = createMockWindow()
      linkMockWindows(otherWindowA, otherWindowB, 'http://host-a.com', 'http://host-b.com')
      const brokerA = createBroker({ name: 'broker-a2', contract: contractA, window: <Window>(<unknown>otherWindowA) })
      const brokerB = createBroker({ name: 'broker-b2', contract: contractB, window: <Window>(<unknown>otherWindowB) })
      const channelA = brokerA.addChannel('to-b', <Window>(<unknown>otherWindowB))
      const channelB = brokerB.addChannel('to-a', <Window>(<unknown>otherWindowA))
      channelB.connect()
      channelA.connect()

      expect([first.channelA.isActive(), first.channelB.isActive(), channelA.isActive(), channelB.isActive()]).toEqual([
        true,
        true,
        true,
        true,
      ])
    })

    it('allows message exchange after handshake', () => {
      const { contractA, contractB } = createContractPair(['PING'], ['PONG'])
      const { channelA, channelB } = setupPair(contractA, contractB)

      channelA.connect()
      channelB.connect()

      const messagesB: unknown[] = []
      channelB.onMessage((msg) => messagesB.push(msg))

      channelA.send('PING', { timestamp: 123 })

      expect(messagesB).toEqual([expect.objectContaining({ type: 'PING', data: { timestamp: 123 } })])
    })
  })

  describe('Glare Convergence', () => {
    it('converges to a single connection when both sides request simultaneously', () => {
      const { contractA, contractB } = createContractPair(['PING'], ['PONG'])

      // how: Windows start unlinked so both REQUESTs drop and both sides are
      windowA.postMessage.mockImplementation(() => undefined)
      windowB.postMessage.mockImplementation(() => undefined)

      const brokerA = createBroker({ name: 'broker-a', contract: contractA, window: <Window>(<unknown>windowA) })
      const brokerB = createBroker({ name: 'broker-b', contract: contractB, window: <Window>(<unknown>windowB) })
      const channelA = brokerA.addChannel('to-b', <Window>(<unknown>windowB))
      const channelB = brokerB.addChannel('to-a', <Window>(<unknown>windowA))

      channelA.connect()
      channelB.connect()

      expect([channelA.isActive(), channelB.isActive()]).toEqual([false, false])

      linkMockWindows(windowA, windowB, 'http://host-a.com', 'http://host-b.com')
      jest.advanceTimersByTime(1000)

      expect([channelA.isActive(), channelB.isActive()]).toEqual([true, true])
    })

    it('fires exactly one open event per side after glare resolution', () => {
      const { contractA, contractB } = createContractPair(['PING'], ['PONG'])

      windowA.postMessage.mockImplementation(() => undefined)
      windowB.postMessage.mockImplementation(() => undefined)

      const brokerA = createBroker({ name: 'broker-a', contract: contractA, window: <Window>(<unknown>windowA) })
      const brokerB = createBroker({ name: 'broker-b', contract: contractB, window: <Window>(<unknown>windowB) })
      const channelA = brokerA.addChannel('to-b', <Window>(<unknown>windowB))
      const channelB = brokerB.addChannel('to-a', <Window>(<unknown>windowA))

      const openA = jest.fn()
      const openB = jest.fn()
      channelA.on('open', openA)
      channelB.on('open', openB)

      channelA.connect()
      channelB.connect()
      linkMockWindows(windowA, windowB, 'http://host-a.com', 'http://host-b.com')
      jest.advanceTimersByTime(2000)

      expect([openA.mock.calls.length, openB.mock.calls.length]).toEqual([1, 1])
    })
  })

  describe('Deadline', () => {
    it('fires timeout when no counterpart answers within the deadline', () => {
      const { contractA } = createContractPair(['PING'], ['PONG'])

      windowB.postMessage.mockImplementation(() => undefined)

      const brokerA = createBroker({ name: 'broker-a', contract: contractA, window: <Window>(<unknown>windowA) })
      const channelA = brokerA.addChannel('to-b', <Window>(<unknown>windowB))

      const timeoutHandler = jest.fn()
      channelA.on('connect-timeout', timeoutHandler)

      channelA.connect()
      jest.advanceTimersByTime(10_000)

      expect(timeoutHandler).toHaveBeenCalledWith({ elapsedMs: 10_000 }, expect.objectContaining({ active: false }))
    })

    it('re-sends REQUEST at the retry cadence until the deadline', () => {
      const { contractA } = createContractPair(['PING'], ['PONG'])

      windowB.postMessage.mockImplementation(() => undefined)

      const brokerA = createBroker({ name: 'broker-a', contract: contractA, window: <Window>(<unknown>windowA) })
      const channelA = brokerA.addChannel('to-b', <Window>(<unknown>windowB), { requestRetryMs: 500 })

      channelA.connect()
      jest.advanceTimersByTime(1500)

      expect(postedTypes(windowB)).toEqual([
        ACTION_TYPES.REQUEST_CONNECTION,
        ACTION_TYPES.REQUEST_CONNECTION,
        ACTION_TYPES.REQUEST_CONNECTION,
        ACTION_TYPES.REQUEST_CONNECTION,
      ])
    })

    it('honors a custom connectTimeoutMs', () => {
      const { contractA } = createContractPair(['PING'], ['PONG'])

      windowB.postMessage.mockImplementation(() => undefined)

      const brokerA = createBroker({ name: 'broker-a', contract: contractA, window: <Window>(<unknown>windowA) })
      const channelA = brokerA.addChannel('to-b', <Window>(<unknown>windowB), { connectTimeoutMs: 2000 })

      const timeoutHandler = jest.fn()
      channelA.on('connect-timeout', timeoutHandler)

      channelA.connect()
      jest.advanceTimersByTime(2000)

      expect(timeoutHandler).toHaveBeenCalledWith({ elapsedMs: 2000 }, expect.anything())
    })

    it('allows reconnecting after a timeout', () => {
      const { contractA, contractB } = createContractPair(['PING'], ['PONG'])

      windowB.postMessage.mockImplementation(() => undefined)

      const brokerA = createBroker({ name: 'broker-a', contract: contractA, window: <Window>(<unknown>windowA) })
      const brokerB = createBroker({ name: 'broker-b', contract: contractB, window: <Window>(<unknown>windowB) })
      const channelA = brokerA.addChannel('to-b', <Window>(<unknown>windowB))
      const channelB = brokerB.addChannel('to-a', <Window>(<unknown>windowA))

      channelA.connect()
      jest.advanceTimersByTime(10_000)
      expect(channelA.isActive()).toBe(false)

      linkMockWindows(windowA, windowB, 'http://host-a.com', 'http://host-b.com')
      channelB.connect()
      channelA.connect()

      expect([channelA.isActive(), channelB.isActive()]).toEqual([true, true])
    })

    it('retains queued messages across a timeout and delivers them once connected', () => {
      const { contractA, contractB } = createContractPair(['PING'], ['PONG'])

      windowB.postMessage.mockImplementation(() => undefined)

      const brokerA = createBroker({ name: 'broker-a', contract: contractA, window: <Window>(<unknown>windowA) })
      const brokerB = createBroker({ name: 'broker-b', contract: contractB, window: <Window>(<unknown>windowB) })
      const channelA = brokerA.addChannel('to-b', <Window>(<unknown>windowB))
      const channelB = brokerB.addChannel('to-a', <Window>(<unknown>windowA))

      channelA.send('PING', { seq: 1 })
      channelA.connect()
      jest.advanceTimersByTime(10_000)

      const messagesB: unknown[] = []
      channelB.onMessage((msg) => messagesB.push(msg))

      linkMockWindows(windowA, windowB, 'http://host-a.com', 'http://host-b.com')
      channelB.connect()
      channelA.connect()

      expect(messagesB).toEqual([expect.objectContaining({ type: 'PING', data: { seq: 1 } })])
    })
  })

  describe('Duplicate-Message Idempotence', () => {
    it('replays ACCEPT for a duplicate REQUEST without firing open again', () => {
      const { contractA, contractB } = createContractPair(['PING'], ['PONG'])
      const { channelA, channelB } = setupPair(contractA, contractB)

      const openB = jest.fn()
      channelB.on('open', openB)

      channelB.connect()
      channelA.connect()

      const requestFrame = <{ type: string }>windowA.postMessage.mock.calls[0][0]
      expect(requestFrame.type).toBe(ACTION_TYPES.REQUEST_CONNECTION)

      windowA.postMessage.mockClear()
      simulateMessage(windowA, requestFrame, 'http://host-b.com', windowB)

      expect({ replayed: postedTypes(windowB).includes(ACTION_TYPES.ACCEPT_CONNECTION), opens: openB.mock.calls.length }).toEqual({
        replayed: true,
        opens: 1,
      })
    })

    it('replays OPEN for a duplicate ACCEPT without firing open again', () => {
      const { contractA, contractB } = createContractPair(['PING'], ['PONG'])
      const { channelA, channelB } = setupPair(contractA, contractB)

      const openA = jest.fn()
      channelA.on('open', openA)

      channelB.connect()
      channelA.connect()

      const acceptFrame = <{ type: string }>(
        windowB.postMessage.mock.calls.map((call) => <{ type: string }>call[0]).find((a) => a.type === ACTION_TYPES.ACCEPT_CONNECTION)
      )
      expect(acceptFrame).toBeDefined()

      windowB.postMessage.mockClear()
      simulateMessage(windowB, acceptFrame, 'http://host-a.com', windowA)

      expect({ replayed: postedTypes(windowA).includes(ACTION_TYPES.OPEN_CONNECTION), opens: openA.mock.calls.length }).toEqual({
        replayed: true,
        opens: 1,
      })
    })

    it('ignores a duplicate OPEN once the process completed', () => {
      const { contractA, contractB } = createContractPair(['PING'], ['PONG'])
      const { channelA, channelB } = setupPair(contractA, contractB)

      const openB = jest.fn()
      channelB.on('open', openB)

      channelB.connect()
      channelA.connect()

      const openFrame = windowA.postMessage.mock.calls
        .map((call) => <{ type: string }>call[0])
        .find((a) => a.type === ACTION_TYPES.OPEN_CONNECTION)
      expect(openFrame).toBeDefined()

      simulateMessage(windowA, openFrame, 'http://host-b.com', windowB)

      expect(openB).toHaveBeenCalledTimes(1)
    })
  })

  describe('Origin Pinning', () => {
    it('targets the pinned origin on product sends after the handshake', () => {
      const { contractA, contractB } = createContractPair(['PING'], ['PONG'])
      const { channelA, channelB } = setupPair(contractA, contractB)

      channelA.connect()
      channelB.connect()

      windowB.postMessage.mockClear()
      channelA.send('PING', {})

      expect(windowB.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: ACTION_TYPES.NEW_MESSAGE }), 'http://host-b.com')
    })

    it('drops inbound messages whose origin does not match the pin', () => {
      const { contractA, contractB } = createContractPair(['PING'], ['PONG'])
      const { channelA, channelB } = setupPair(contractA, contractB)

      channelA.connect()
      channelB.connect()

      const messagesB: unknown[] = []
      channelB.onMessage((msg) => messagesB.push(msg))

      simulateMessage(
        windowB,
        { type: ACTION_TYPES.NEW_MESSAGE, senderId: channelA.getId(), data: { type: 'PING', data: {} } },
        'http://evil.example',
        windowA
      )

      expect(messagesB).toEqual([])
    })

    it('delivers inbound messages from the pinned origin', () => {
      const { contractA, contractB } = createContractPair(['PING'], ['PONG'])
      const { brokerA, channelA, channelB } = setupPair(contractA, contractB)

      channelA.connect()
      channelB.connect()

      const messagesB: unknown[] = []
      channelB.onMessage((msg) => messagesB.push(msg))

      simulateMessage(
        windowB,
        { type: ACTION_TYPES.NEW_MESSAGE, senderId: brokerA.id, data: { type: 'PING', data: {} } },
        'http://host-a.com',
        windowA
      )

      expect(messagesB).toEqual([expect.objectContaining({ type: 'PING' })])
    })
  })

  describe('Denial Flow', () => {
    it('denies when the peer does not emit a required action', () => {
      const contractA: IChannelContract = {
        emitted: [{ type: 'UNKNOWN_TYPE' }],
        accepted: [{ type: 'PONG' }],
      }
      const contractB: IChannelContract = {
        emitted: [{ type: 'PONG' }],
        accepted: [{ type: 'PING', required: true }],
      }
      const { channelA, channelB } = setupPair(contractA, contractB)

      const denyHandler = jest.fn()
      channelA.on('deny', denyHandler)

      // how: B becomes a ready responder with no outstanding request, so A's connect() faces the requirements gate.
      channelB.connect()
      channelB.cancel(false)
      channelA.cancel(false)
      channelA.connect()

      expect(denyHandler).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Incompatible contract: missing required actions PING.' }),
        expect.anything()
      )
    })

    it('connects when the peer emits additional types outside the own vocabulary', () => {
      const contractA: IChannelContract = {
        emitted: [{ type: 'PING' }, { type: 'NEWER_OPTIONAL_TYPE' }],
        accepted: [{ type: 'PONG' }],
      }
      const contractB: IChannelContract = {
        emitted: [{ type: 'PONG' }],
        accepted: [{ type: 'PING', required: true }],
      }
      const { channelA, channelB } = setupPair(contractA, contractB)

      channelB.connect()
      channelA.connect()

      expect([channelA.isActive(), channelB.isActive()]).toEqual([true, true])
    })

    it('stays inactive after a denial', () => {
      const contractA: IChannelContract = {
        emitted: [{ type: 'UNKNOWN_TYPE' }],
        accepted: [{ type: 'PONG' }],
      }
      const contractB: IChannelContract = {
        emitted: [{ type: 'PONG' }],
        accepted: [{ type: 'PING', required: true }],
      }
      const { channelA, channelB } = setupPair(contractA, contractB)

      channelB.connect()
      channelA.connect()

      expect([channelA.isActive(), channelB.isActive()]).toEqual([false, false])
    })

    it('denies on security policy rejection', () => {
      const { contractA, contractB } = createContractPair(['MSG'], ['ACK'])
      const { brokerB, channelA, channelB } = setupPair(contractA, contractB)

      brokerB.setSecurityPolicy(() => false)

      const denyHandler = jest.fn()
      channelA.on('deny', denyHandler)

      channelB.connect()
      channelB.cancel(false)
      channelA.cancel(false)
      channelA.connect()

      expect(denyHandler).toHaveBeenCalledWith(expect.objectContaining({ error: 'Not accepted.' }), expect.anything())
    })

    it('stops retrying after a denial', () => {
      const { contractA, contractB } = createContractPair(['MSG'], ['ACK'])
      const { brokerB, channelA, channelB } = setupPair(contractA, contractB)

      brokerB.setSecurityPolicy(() => false)

      channelB.connect()
      channelB.cancel(false)
      channelA.cancel(false)
      channelA.connect()

      windowB.postMessage.mockClear()
      jest.advanceTimersByTime(5000)

      expect(postedTypes(windowB)).toEqual([])
    })
  })

  describe('Cancellation Flow', () => {
    it('cancels pending connection: CANCEL → CANCEL_ACK', () => {
      const { contractA, contractB } = createContractPair(['MSG'], ['ACK'])
      const { channelA } = setupPair(contractA, contractB)

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

    it('keeps the channel registered after cancellation', () => {
      const { contractA, contractB } = createContractPair(['MSG'], ['ACK'])
      const { brokerA, channelA } = setupPair(contractA, contractB)

      channelA.connect()
      channelA.cancel()

      expect(brokerA.getChannel('to-b')).toBeDefined()
    })
  })

  describe('Close Flow', () => {
    it('closes gracefully: CLOSE → CLOSE_ACK', () => {
      const { contractA, contractB } = createContractPair(['MSG'], ['ACK'])
      const { channelA, channelB } = setupPair(contractA, contractB)

      const closeHandlerA = jest.fn()
      channelA.on('close', closeHandlerA)

      channelA.connect()
      channelB.connect()

      expect([channelA.isActive(), channelB.isActive()]).toEqual([true, true])

      channelA.disconnect()

      expect(channelA.isActive()).toBe(false)
      expect(closeHandlerA).toHaveBeenCalled()
    })

    it('allows reconnection after close', () => {
      const { contractA, contractB } = createContractPair(['MSG'], ['ACK'])
      const { channelA, channelB } = setupPair(contractA, contractB)

      channelA.connect()
      channelB.connect()
      expect(channelA.isActive()).toBe(true)

      channelA.disconnect()
      expect(channelA.isActive()).toBe(false)

      channelB.connect()
      channelA.connect()
      expect(channelA.isActive()).toBe(true)
    })
  })

  describe('Scheduled Activation', () => {
    it('handshakes when the responder connects after the request arrived', () => {
      const { contractA, contractB } = createContractPair(['MSG'], ['ACK'])
      const { channelA, channelB } = setupPair(contractA, contractB)

      channelA.connect()

      expect(channelA.isActive()).toBe(false)

      channelB.connect()

      expect([channelA.isActive(), channelB.isActive()]).toEqual([true, true])
    })

    it('handshakes immediately when the responder is already connected', () => {
      const { contractA, contractB } = createContractPair(['MSG'], ['ACK'])
      const { channelA, channelB } = setupPair(contractA, contractB)

      channelB.connect()
      channelA.connect()

      expect([channelA.isActive(), channelB.isActive()]).toEqual([true, true])
    })
  })

  describe('Page Reload Detection', () => {
    it('re-handshakes when the counterpart reloads with a new broker id', () => {
      const { contractA, contractB } = createContractPair(['MSG'], ['ACK'])
      const { channelA, channelB } = setupPair(contractA, contractB)

      channelA.connect()
      channelB.connect()
      expect([channelA.isActive(), channelB.isActive()]).toEqual([true, true])

      // how: A reloaded page re-creates its broker in the same window; the
      const brokerA2 = createBroker({ name: 'broker-a-reloaded', contract: contractA, window: <Window>(<unknown>windowA) })
      const channelA2 = brokerA2.addChannel('to-b', <Window>(<unknown>windowB))
      channelA2.connect()

      expect([channelA2.isActive(), channelB.isActive()]).toEqual([true, true])
    })

    it('ends the session with a reload reason, then opens again for the fresh instance', () => {
      const { contractA, contractB } = createContractPair(['MSG'], ['ACK'])
      const { channelA, channelB } = setupPair(contractA, contractB)

      channelA.connect()
      channelB.connect()

      const events: unknown[] = []
      channelB.on('close', (data) => events.push({ close: data }))
      channelB.on('open', () => events.push({ open: true }))

      const brokerA2 = createBroker({ name: 'broker-a-reloaded', contract: contractA, window: <Window>(<unknown>windowA) })
      brokerA2.addChannel('to-b', <Window>(<unknown>windowB)).connect()

      expect({ events, peerId: channelB.getPeerId() }).toEqual({
        events: [{ close: { notify: false, reason: 'peer-reload' } }, { open: true }],
        peerId: brokerA2.id,
      })
    })

    it('drops product messages left over from the instance that reloaded', () => {
      const { contractA, contractB } = createContractPair(['MSG'], ['ACK'])
      const { brokerA, channelA, channelB } = setupPair(contractA, contractB)

      channelA.connect()
      channelB.connect()

      const brokerA2 = createBroker({ name: 'broker-a-reloaded', contract: contractA, window: <Window>(<unknown>windowA) })
      brokerA2.addChannel('to-b', <Window>(<unknown>windowB)).connect()

      const messagesB: unknown[] = []
      channelB.onMessage((msg) => messagesB.push(msg))

      simulateMessage(
        windowB,
        { type: ACTION_TYPES.NEW_MESSAGE, senderId: brokerA.id, data: { type: 'MSG', data: {} } },
        'http://host-a.com',
        windowA
      )

      expect(messagesB).toEqual([])
    })
  })
})
