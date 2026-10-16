import type { IChannelContract } from '../../types/contract'
import type { IMessage } from '../../types/message'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { activate } from './activate'
import { clearQueue } from './clear-queue'
import { deactivate } from './deactivate'
import { createInitialState } from './initial'
import { queueMessage } from './queue-message'
import { setOrigin } from './set-origin'

// why: the sequence comes from the mock's own call record because the replacement stands as a module of its own and cannot reach the spec's scope. Clearing the mock is what restarts it, which is what the counter reset did.
jest.mock('@hyperfrontend/random-generator-utils', () => {
  const uuidV4 = jest.fn(() => `test-id-${uuidV4.mock.calls.length}`)
  return {
    uuidV4,
    isUuidV4: jest.fn((id: string) => typeof id === 'string' && id.length > 0),
  }
})

describe('Channel State Management', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const defaultSettings = { queueMessages: true }

  describe('createInitialState', () => {
    it('creates initial state with all fields', () => {
      const name = 'test-channel'
      const target = window

      const state = createInitialState(name, target, defaultSettings)

      expect(state).toEqual(
        expect.objectContaining({
          id: 'test-id-1',
          name,
          target,
          origin: null,
          active: false,
          connectTimestamp: null,
          contract: null,
          acceptedActions: [],
          queuedMessages: [],
          eventSubscriptions: [],
          messageSubscriptions: [],
          scheduledActivation: null,
          queueMessages: true,
          readyToConnect: false,
        })
      )
    })

    it('uses default values when settings are empty', () => {
      const state = createInitialState('test-channel', window, {})

      expect(state.queueMessages).toBe(true)
    })

    it('generates unique IDs for different channels', () => {
      const state1 = createInitialState('channel-1', window, defaultSettings)
      const state2 = createInitialState('channel-2', window, defaultSettings)

      expect([state1.id, state2.id]).toEqual(['test-id-1', 'test-id-2'])
    })
  })

  describe('activate', () => {
    const ownContract: IChannelContract = {
      emitted: [{ type: 'action1' }],
      accepted: [{ type: 'action2' }, { type: 'action3' }],
    }
    const peerContract: IChannelContract = {
      emitted: [{ type: 'action2' }],
      accepted: [{ type: 'action1' }],
    }

    it('activates the channel and stores the peer details', () => {
      const initialState = createInitialState('test', window, { ...defaultSettings, contract: ownContract })

      const newState = activate(initialState, 'https://example.com', peerContract, 'peer-1')

      expect(newState).toEqual(
        expect.objectContaining({
          origin: 'https://example.com',
          active: true,
          contract: ownContract,
          peerContract,
          peerId: 'peer-1',
          scheduledActivation: null,
          pendingAccept: null,
          pendingProcessId: null,
        })
      )
    })

    it('derives accepted actions from the own contract, not the peer contract', () => {
      const initialState = createInitialState('test', window, { ...defaultSettings, contract: ownContract })

      const newState = activate(initialState, 'https://example.com', peerContract, 'peer-1')

      expect(newState.acceptedActions).toEqual(['action2', 'action3'])
    })

    it('sets the connect timestamp', () => {
      const initialState = createInitialState('test', window, { ...defaultSettings, contract: ownContract })

      const newState = activate(initialState, 'https://example.com', peerContract, 'peer-1')

      expect(newState.connectTimestamp).toBeGreaterThan(0)
    })

    it('handles a channel without an own contract', () => {
      const initialState = createInitialState('test', window, defaultSettings)

      const newState = activate(initialState, 'https://example.com', peerContract, 'peer-1')

      expect(newState.acceptedActions).toEqual([])
    })

    it('does not mutate original state', () => {
      const initialState = createInitialState('test', window, defaultSettings)

      const newState = activate(initialState, 'https://example.com', peerContract, 'peer-1')

      expect({ active: initialState.active, origin: initialState.origin, sameReference: newState === initialState }).toEqual({
        active: false,
        origin: null,
        sameReference: false,
      })
    })
  })

  describe('deactivate', () => {
    it('marks channel as inactive', () => {
      const ownContract: IChannelContract = { emitted: [], accepted: [{ type: 'action1' }] }
      const initialState = createInitialState('test', window, { ...defaultSettings, contract: ownContract })
      const activeState = activate(
        initialState,
        'https://example.com',
        {
          emitted: [],
          accepted: [{ type: 'action1' }],
        },
        'peer-1'
      )

      const inactiveState = deactivate(activeState)

      expect(inactiveState).toEqual(expect.objectContaining({ active: false, origin: 'https://example.com', contract: ownContract }))
    })

    it('does not mutate original state', () => {
      const activeState = { ...createInitialState('test', window, defaultSettings), active: true }

      const inactiveState = deactivate(activeState)

      expect({ active: activeState.active, sameReference: inactiveState === activeState }).toEqual({ active: true, sameReference: false })
    })
  })

  describe('setOrigin', () => {
    it('updates origin', () => {
      const initialState = createInitialState('test', window, defaultSettings)
      const origin = 'https://example.com'

      const newState = setOrigin(initialState, origin)

      expect(newState.origin).toBe(origin)
    })

    it('does not mutate original state', () => {
      const initialState = createInitialState('test', window, defaultSettings)
      const origin = 'https://example.com'

      const newState = setOrigin(initialState, origin)

      expect({ origin: initialState.origin, sameReference: newState === initialState }).toEqual({ origin: null, sameReference: false })
    })
  })

  describe('queueMessage', () => {
    it('adds message to queue', () => {
      const initialState = createInitialState('test', window, defaultSettings)
      const message: IMessage = { type: 'test-message', data: { foo: 'bar' } }

      const newState = queueMessage(initialState, message)
      const queued = newState.queuedMessages

      expect({ count: queued.length, sameMessage: queued[0] === message }).toEqual({ count: 1, sameMessage: true })
    })

    it('appends messages to existing queue', () => {
      const initialState = createInitialState('test', window, defaultSettings)
      const message1: IMessage = { type: 'message-1' }
      const message2: IMessage = { type: 'message-2' }

      const state1 = queueMessage(initialState, message1)
      const state2 = queueMessage(state1, message2)
      const queued = state2.queuedMessages
      const copiedOrMisplaced = [message1, message2].filter((message, index) => queued[index] !== message)

      expect({ count: queued.length, copiedOrMisplaced }).toEqual({ count: 2, copiedOrMisplaced: [] })
    })

    it('does not mutate original state or queue', () => {
      const initialState = createInitialState('test', window, defaultSettings)
      const message: IMessage = { type: 'test-message' }

      const newState = queueMessage(initialState, message)

      expect({ originalQueue: initialState.queuedMessages, sameQueue: newState.queuedMessages === initialState.queuedMessages }).toEqual({
        originalQueue: [],
        sameQueue: false,
      })
    })
  })

  describe('clearQueue', () => {
    it('clears queued messages', () => {
      const initialState = createInitialState('test', window, defaultSettings)
      const message1: IMessage = { type: 'message-1' }
      const message2: IMessage = { type: 'message-2' }

      const stateWithMessages = queueMessage(queueMessage(initialState, message1), message2)
      const clearedState = clearQueue(stateWithMessages)

      expect(clearedState.queuedMessages).toHaveLength(0)
    })

    it('does not mutate original state', () => {
      const initialState = createInitialState('test', window, defaultSettings)
      const message: IMessage = { type: 'test-message' }
      const stateWithMessages = queueMessage(initialState, message)

      const clearedState = clearQueue(stateWithMessages)

      expect({
        originalQueue: stateWithMessages.queuedMessages,
        sameQueue: clearedState.queuedMessages === stateWithMessages.queuedMessages,
      }).toEqual({ originalQueue: [message], sameQueue: false })
    })

    it('works on already empty queue', () => {
      const initialState = createInitialState('test', window, defaultSettings)

      const clearedState = clearQueue(initialState)

      expect(clearedState.queuedMessages).toHaveLength(0)
    })
  })
})
