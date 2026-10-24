import type { FakeWindow } from '@hyperfrontend/testing/browser'
import type { IAction } from '../types/action'
import type { IChannelContract } from '../types/contract'
import { after as afterAll, afterEach, before as beforeAll, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createWindowPair } from '@hyperfrontend/testing/browser'
import { createBroker } from '../broker/factory'
import { ACTION_TYPES } from '../types/action'
import { collectEvents, createContractPair, plaintextFramesTo } from './test-utils'

describe('Connection Flow Integration', () => {
  let windowA: FakeWindow
  let windowB: FakeWindow

  beforeAll(() => {
    jest.useFakeTimers()
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  beforeEach(() => {
    ;[windowA, windowB] = createWindowPair({ origins: ['http://host-a.com', 'http://host-b.com'], delivery: 'sync' })
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.clearAllMocks()
  })

  const setupPair = (contractA: IChannelContract, contractB: IChannelContract) => {
    const brokerA = createBroker({ name: 'broker-a', contract: contractA, window: windowA })
    const brokerB = createBroker({ name: 'broker-b', contract: contractB, window: windowB })
    return {
      brokerA,
      brokerB,
      channelA: brokerA.addChannel('to-b', windowB),
      channelB: brokerB.addChannel('to-a', windowA),
    }
  }

  const postedTypes = (target: FakeWindow) => target.posted().map((frame) => (frame as { type: string }).type)

  // how: a test that silenced a window with mockImplementation links it again by delivering each post as the paired window would.
  const relink = (): void => {
    windowA.postMessage.mockImplementation((data: unknown) => windowA.receive(data, { origin: 'http://host-b.com', source: windowB }))
    windowB.postMessage.mockImplementation((data: unknown) => windowB.receive(data, { origin: 'http://host-a.com', source: windowA }))
  }

  const activity = (a: { isActive(): boolean }, b: { isActive(): boolean }) => ({ a: a.isActive(), b: b.isActive() })

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

      expect({ openA: openA.mock.calls, openB: openB.mock.calls }).toEqual({
        openA: [[expect.objectContaining({ origin: 'http://host-b.com', contract: contractB }), expect.objectContaining({ active: true })]],
        openB: [[expect.objectContaining({ origin: 'http://host-a.com', contract: contractA }), expect.objectContaining({ active: true })]],
      })
    })

    it('activates symmetrically regardless of which side initiates', () => {
      const { contractA, contractB } = createContractPair(['PING'], ['PONG'])
      const first = setupPair(contractA, contractB)
      first.channelA.connect()
      first.channelB.connect()

      const [otherWindowA, otherWindowB] = createWindowPair({ origins: ['http://host-a.com', 'http://host-b.com'], delivery: 'sync' })
      const brokerA = createBroker({ name: 'broker-a2', contract: contractA, window: otherWindowA })
      const brokerB = createBroker({ name: 'broker-b2', contract: contractB, window: otherWindowB })
      const channelA = brokerA.addChannel('to-b', otherWindowB)
      const channelB = brokerB.addChannel('to-a', otherWindowA)
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

      // how: Windows start unlinked so both REQUESTs drop and both sides are left retrying; linking them lets the retries collide and the tie-break resolve the glare.
      windowA.postMessage.mockImplementation(() => undefined)
      windowB.postMessage.mockImplementation(() => undefined)

      const brokerA = createBroker({ name: 'broker-a', contract: contractA, window: windowA })
      const brokerB = createBroker({ name: 'broker-b', contract: contractB, window: windowB })
      const channelA = brokerA.addChannel('to-b', windowB)
      const channelB = brokerB.addChannel('to-a', windowA)

      channelA.connect()
      channelB.connect()
      const beforeLink = activity(channelA, channelB)

      relink()
      jest.advanceTimersByTime(1000)

      expect({ beforeLink, afterLink: activity(channelA, channelB) }).toEqual({
        beforeLink: { a: false, b: false },
        afterLink: { a: true, b: true },
      })
    })

    it('fires exactly one open event per side after glare resolution', () => {
      const { contractA, contractB } = createContractPair(['PING'], ['PONG'])

      windowA.postMessage.mockImplementation(() => undefined)
      windowB.postMessage.mockImplementation(() => undefined)

      const brokerA = createBroker({ name: 'broker-a', contract: contractA, window: windowA })
      const brokerB = createBroker({ name: 'broker-b', contract: contractB, window: windowB })
      const channelA = brokerA.addChannel('to-b', windowB)
      const channelB = brokerB.addChannel('to-a', windowA)

      const openA = jest.fn()
      const openB = jest.fn()
      channelA.on('open', openA)
      channelB.on('open', openB)

      channelA.connect()
      channelB.connect()
      relink()
      jest.advanceTimersByTime(2000)

      expect([openA.mock.calls.length, openB.mock.calls.length]).toEqual([1, 1])
    })
  })

  describe('Deadline', () => {
    it('fires timeout when no counterpart answers within the deadline', () => {
      const { contractA } = createContractPair(['PING'], ['PONG'])

      windowB.postMessage.mockImplementation(() => undefined)

      const brokerA = createBroker({ name: 'broker-a', contract: contractA, window: windowA })
      const channelA = brokerA.addChannel('to-b', windowB)

      const timeoutHandler = jest.fn()
      channelA.on('connect-timeout', timeoutHandler)

      channelA.connect()
      jest.advanceTimersByTime(10_000)

      expect(timeoutHandler).toHaveBeenCalledWith({ elapsedMs: 10_000 }, expect.objectContaining({ active: false }))
    })

    it('re-sends REQUEST at the retry cadence until the deadline', () => {
      const { contractA } = createContractPair(['PING'], ['PONG'])

      windowB.postMessage.mockImplementation(() => undefined)

      const brokerA = createBroker({ name: 'broker-a', contract: contractA, window: windowA })
      const channelA = brokerA.addChannel('to-b', windowB, { requestRetryMs: 500 })

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

      const brokerA = createBroker({ name: 'broker-a', contract: contractA, window: windowA })
      const channelA = brokerA.addChannel('to-b', windowB, { connectTimeoutMs: 2000 })

      const timeoutHandler = jest.fn()
      channelA.on('connect-timeout', timeoutHandler)

      channelA.connect()
      jest.advanceTimersByTime(2000)

      expect(timeoutHandler).toHaveBeenCalledWith({ elapsedMs: 2000 }, expect.anything())
    })

    it('allows reconnecting after a timeout', () => {
      const { contractA, contractB } = createContractPair(['PING'], ['PONG'])

      windowB.postMessage.mockImplementation(() => undefined)

      const brokerA = createBroker({ name: 'broker-a', contract: contractA, window: windowA })
      const brokerB = createBroker({ name: 'broker-b', contract: contractB, window: windowB })
      const channelA = brokerA.addChannel('to-b', windowB)
      const channelB = brokerB.addChannel('to-a', windowA)

      channelA.connect()
      jest.advanceTimersByTime(10_000)
      const activeAfterTimeout = channelA.isActive()

      relink()
      channelB.connect()
      channelA.connect()

      expect({ activeAfterTimeout, afterReconnect: activity(channelA, channelB) }).toEqual({
        activeAfterTimeout: false,
        afterReconnect: { a: true, b: true },
      })
    })

    it('retains queued messages across a timeout and delivers them once connected', () => {
      const { contractA, contractB } = createContractPair(['PING'], ['PONG'])

      windowB.postMessage.mockImplementation(() => undefined)

      const brokerA = createBroker({ name: 'broker-a', contract: contractA, window: windowA })
      const brokerB = createBroker({ name: 'broker-b', contract: contractB, window: windowB })
      const channelA = brokerA.addChannel('to-b', windowB)
      const channelB = brokerB.addChannel('to-a', windowA)

      channelA.send('PING', { seq: 1 })
      channelA.connect()
      jest.advanceTimersByTime(10_000)

      const messagesB: unknown[] = []
      channelB.onMessage((msg) => messagesB.push(msg))

      relink()
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

      const requestFrame = plaintextFramesTo(windowA)[0]

      windowA.postMessage.mockClear()
      windowA.receive(requestFrame, { origin: 'http://host-b.com', source: windowB })

      expect({
        duplicated: requestFrame.type,
        replayed: postedTypes(windowB).includes(ACTION_TYPES.ACCEPT_CONNECTION),
        opens: openB.mock.calls.length,
      }).toEqual({ duplicated: ACTION_TYPES.REQUEST_CONNECTION, replayed: true, opens: 1 })
    })

    it('replays OPEN for a duplicate ACCEPT without firing open again', () => {
      const { contractA, contractB } = createContractPair(['PING'], ['PONG'])
      const { channelA, channelB } = setupPair(contractA, contractB)

      const openA = jest.fn()
      channelA.on('open', openA)

      channelB.connect()
      channelA.connect()

      const acceptFrame = plaintextFramesTo(windowB).find((frame) => frame.type === ACTION_TYPES.ACCEPT_CONNECTION)

      windowB.postMessage.mockClear()
      windowB.receive(acceptFrame as IAction, { origin: 'http://host-a.com', source: windowA })

      expect({
        duplicated: acceptFrame?.type,
        replayed: postedTypes(windowA).includes(ACTION_TYPES.OPEN_CONNECTION),
        opens: openA.mock.calls.length,
      }).toEqual({ duplicated: ACTION_TYPES.ACCEPT_CONNECTION, replayed: true, opens: 1 })
    })

    it('ignores a duplicate OPEN once the process completed', () => {
      const { contractA, contractB } = createContractPair(['PING'], ['PONG'])
      const { channelA, channelB } = setupPair(contractA, contractB)

      const openB = jest.fn()
      channelB.on('open', openB)

      channelB.connect()
      channelA.connect()

      const openFrame = plaintextFramesTo(windowA).find((frame) => frame.type === ACTION_TYPES.OPEN_CONNECTION)

      windowA.receive(openFrame as IAction, { origin: 'http://host-b.com', source: windowB })

      expect({ duplicated: openFrame?.type, opens: openB.mock.calls.length }).toEqual({
        duplicated: ACTION_TYPES.OPEN_CONNECTION,
        opens: 1,
      })
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

      windowB.receive(
        { type: ACTION_TYPES.NEW_MESSAGE, senderId: channelA.getId(), data: { type: 'PING', data: {} } },
        { origin: 'http://evil.example', source: windowA }
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

      windowB.receive(
        { type: ACTION_TYPES.NEW_MESSAGE, senderId: brokerA.id, data: { type: 'PING', data: {} } },
        { origin: 'http://host-a.com', source: windowA }
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

      expect({ active: channelA.isActive(), notified: cancelHandler.mock.calls.length + closeHandler.mock.calls.length > 0 }).toEqual({
        active: false,
        notified: true,
      })
    })

    it('keeps the channel registered after cancellation', () => {
      const { contractA, contractB } = createContractPair(['MSG'], ['ACK'])
      const { brokerA, channelA } = setupPair(contractA, contractB)

      channelA.connect()
      channelA.cancel()

      expect(brokerA.getChannel('to-b')).toBeDefined()
    })

    it('fires cancel exactly once on each side of one cancelled attempt', () => {
      const { contractA, contractB } = createContractPair(['MSG'], ['ACK'])
      const { channelA, channelB } = setupPair(contractA, contractB)

      const cancelledA = collectEvents(channelA, ['cancel'])
      const cancelledB = collectEvents(channelB, ['cancel'])

      channelA.connect()
      channelA.cancel()

      expect({ initiator: cancelledA, responder: cancelledB }).toEqual({
        initiator: [{ event: 'cancel', data: { notify: false } }],
        responder: [{ event: 'cancel', data: { notify: true } }],
      })
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
      const beforeClose = activity(channelA, channelB)

      channelA.disconnect()

      expect({ beforeClose, activeAfterClose: channelA.isActive(), closeFired: closeHandlerA.mock.calls.length > 0 }).toEqual({
        beforeClose: { a: true, b: true },
        activeAfterClose: false,
        closeFired: true,
      })
    })

    it('allows reconnection after close', () => {
      const { contractA, contractB } = createContractPair(['MSG'], ['ACK'])
      const { channelA, channelB } = setupPair(contractA, contractB)

      channelA.connect()
      channelB.connect()
      const afterConnect = channelA.isActive()

      channelA.disconnect()
      const afterDisconnect = channelA.isActive()

      channelB.connect()
      channelA.connect()

      expect({ afterConnect, afterDisconnect, afterReconnect: channelA.isActive() }).toEqual({
        afterConnect: true,
        afterDisconnect: false,
        afterReconnect: true,
      })
    })
  })

  describe('Scheduled Activation', () => {
    it('handshakes when the responder connects after the request arrived', () => {
      const { contractA, contractB } = createContractPair(['MSG'], ['ACK'])
      const { channelA, channelB } = setupPair(contractA, contractB)

      channelA.connect()
      const initiatorActiveAlone = channelA.isActive()

      channelB.connect()

      expect({ initiatorActiveAlone, afterResponderConnects: activity(channelA, channelB) }).toEqual({
        initiatorActiveAlone: false,
        afterResponderConnects: { a: true, b: true },
      })
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
      const beforeReload = activity(channelA, channelB)

      // how: A reloaded page re-creates its broker in the same window, so the counterpart sees a REQUEST from a new sender id.
      const brokerA2 = createBroker({ name: 'broker-a-reloaded', contract: contractA, window: windowA })
      const channelA2 = brokerA2.addChannel('to-b', windowB)
      channelA2.connect()

      expect({ beforeReload, afterReload: activity(channelA2, channelB) }).toEqual({
        beforeReload: { a: true, b: true },
        afterReload: { a: true, b: true },
      })
    })

    it('ends the session with a reload reason, then opens again for the fresh instance', () => {
      const { contractA, contractB } = createContractPair(['MSG'], ['ACK'])
      const { channelA, channelB } = setupPair(contractA, contractB)

      channelA.connect()
      channelB.connect()

      const events: unknown[] = []
      channelB.on('close', (data) => events.push({ close: data }))
      channelB.on('open', () => events.push({ open: true }))

      const brokerA2 = createBroker({ name: 'broker-a-reloaded', contract: contractA, window: windowA })
      brokerA2.addChannel('to-b', windowB).connect()

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

      const brokerA2 = createBroker({ name: 'broker-a-reloaded', contract: contractA, window: windowA })
      brokerA2.addChannel('to-b', windowB).connect()

      const messagesB: unknown[] = []
      channelB.onMessage((msg) => messagesB.push(msg))

      windowB.receive(
        { type: ACTION_TYPES.NEW_MESSAGE, senderId: brokerA.id, data: { type: 'MSG', data: {} } },
        { origin: 'http://host-a.com', source: windowA }
      )

      expect(messagesB).toEqual([])
    })
  })
})
