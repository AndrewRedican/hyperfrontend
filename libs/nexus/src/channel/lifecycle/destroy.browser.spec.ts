import type { ChannelInternals } from '../types'
import type { ChannelState } from '../../types'
import type { IAction } from '../../types/action'
import { destroy } from './destroy'

// Mutable version of ChannelState for testing
type MutableChannelState = { -readonly [K in keyof ChannelState]: ChannelState[K] }

describe('channel/lifecycle/destroy', () => {
  let mockChannel: ChannelInternals
  let state: MutableChannelState
  let sentActions: IAction[]
  let cleanupCalled: boolean

  beforeEach(() => {
    sentActions = []
    cleanupCalled = false

    state = {
      id: 'channel-123',
      name: 'test-channel',
      target: window,
      origin: 'https://example.com',
      active: true,
      connectTimestamp: Date.now(),
      contract: { accepted: [], emitted: [] },
      acceptedActions: [],
      queuedMessages: [],
      eventSubscriptions: [],
      messageSubscriptions: [],
      scheduledActivation: null,
      queueMessages: true,

      brokerManaged: false,
      readyToConnect: true,
      negotiatedProtocol: null,
      securityReady: false,
      securityTransport: null,
      pendingSecurityRequest: null,
    }

    mockChannel = {
      getState: () => state,
      updateState: (partial) => {
        state = { ...state, ...partial }
      },
      sendAction: (action) => {
        sentActions.push(action)
      },
      createProcess: jest.fn(() => 'process-456'),
      removeProcess: jest.fn(),
      notifyEvent: jest.fn(),
      notifyMessage: jest.fn(),
      actions: {
        requestConnection: jest.fn(),
        acceptConnection: jest.fn(),
        denyConnection: jest.fn(),
        cancelConnection: jest.fn(),
        openConnection: jest.fn(),
        closeConnection: jest.fn(),
        destroyConnection: jest.fn(() => ({
          type: '[nexus] connection-destroyed',
          senderId: 'broker-id',
        })),
        newMessage: jest.fn(),
        invalidRequest: jest.fn(),
      },
      cleanup: jest.fn(() => {
        cleanupCalled = true
      }),
    }
  })

  it('sets channel to inactive immediately', () => {
    destroy(mockChannel)

    expect(state.active).toBe(false)
  })

  it('sends DESTROY_CONNECTION when notify is true (default)', () => {
    destroy(mockChannel)

    expect(mockChannel.actions.destroyConnection).toHaveBeenCalled()
    expect(sentActions).toHaveLength(1)
    expect(sentActions[0].type).toBe('[nexus] connection-destroyed')
  })

  it('sends DESTROY_CONNECTION when notify is explicitly true', () => {
    destroy(mockChannel, true)

    expect(sentActions).toHaveLength(1)
    expect(sentActions[0].type).toBe('[nexus] connection-destroyed')
  })

  it('does not send action when notify is false', () => {
    destroy(mockChannel, false)

    expect(mockChannel.actions.destroyConnection).not.toHaveBeenCalled()
    expect(sentActions).toHaveLength(0)
  })

  it('calls cleanup callback if provided', () => {
    destroy(mockChannel)

    expect(mockChannel.cleanup).toHaveBeenCalled()
    expect(cleanupCalled).toBe(true)
  })

  it('does not throw if cleanup callback is not provided', () => {
    delete mockChannel.cleanup

    expect(() => destroy(mockChannel)).not.toThrow()
  })

  it('works even when channel is already inactive', () => {
    state.active = false

    destroy(mockChannel)

    expect(state.active).toBe(false)
    expect(cleanupCalled).toBe(true)
  })

  it('executes operations in correct order', () => {
    const operations: string[] = []

    mockChannel.updateState = (partial) => {
      state = { ...state, ...partial }
      operations.push('updateState')
    }

    mockChannel.sendAction = (action) => {
      sentActions.push(action)
      operations.push('sendAction')
    }

    mockChannel.cleanup = () => {
      cleanupCalled = true
      operations.push('cleanup')
    }

    mockChannel.notifyEvent = jest.fn(() => {
      operations.push('notifyEvent')
    })

    destroy(mockChannel)

    // Should: 1) set inactive, 2) send action, 3) cleanup (no event for forceful destroy)
    expect(operations).toEqual(['updateState', 'sendAction', 'cleanup'])
  })
})
