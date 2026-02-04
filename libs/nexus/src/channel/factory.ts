import type { IChannelConfig, ChannelHandle, ChannelJSON } from '../types/channel'
import type { ChannelInternals, ChannelDependencies } from './types'
import type { IAction } from '../types/action'
import type { IChannelContract } from '../types/contract'
import type { ChannelEvent } from '../types/events'
import type { IMessage } from '../types/message'
import { DEFAULT_CHANNEL_SETTINGS } from './defaults'
import { createInitialState } from './state/initial'
import { activate as activateState } from './state/activate'
import { connect } from './lifecycle/connect'
import { disconnect } from './lifecycle/disconnect'
import { cancel } from './lifecycle/cancel'
import { destroy } from './lifecycle/destroy'
import { send } from './messaging/send'
import { sendAction as sendActionImpl } from './messaging/send-action'
import { subscribeToEvents } from './subscription/events'
import { subscribeToMessages } from './subscription/messages'
import { notifyEvent } from './subscription/notify-event'
import { notifyMessage } from './subscription/notify-message'

/**
 * Creates a new message channel.
 *
 * Uses functional programming with closures for encapsulation.
 * Returns a public handle with methods while keeping state private.
 *
 * @param config - Channel configuration (name, target, settings)
 * @param deps - Dependencies (action creators, process manager, cleanup)
 * @returns Channel handle with public API
 *
 * @example
 * ```typescript
 * const channel = createChannel(
 *   { name: 'my-channel', target: childWindow },
 *   { actions, processManager, cleanup }
 * )
 * channel.connect()
 * channel.send('greet', { message: 'Hello!' })
 * ```
 */
export function createChannel(config: IChannelConfig, deps: ChannelDependencies): ChannelHandle {
  // Merge settings with defaults
  const settings = { ...DEFAULT_CHANNEL_SETTINGS, ...config.settings }

  // Initialize state (private, mutable via setState only)
  let state = createInitialState(config.name, config.target, settings)

  // Create internal channel API
  const internals: ChannelInternals = {
    getState: () => state,

    updateState: (partial) => {
      state = { ...state, ...partial }
    },

    sendAction: (action: IAction) => {
      sendActionImpl(internals, action)
    },

    createProcess: () => {
      return deps.processManager.create(internals)
    },

    removeProcess: (processId: string) => {
      deps.processManager.remove(processId)
    },

    notifyEvent: (event, data) => {
      notifyEvent(internals, event, data)
    },

    notifyMessage: (message) => {
      notifyMessage(internals, message)
    },

    actions: deps.actions,

    cleanup: deps.cleanup,
  }

  // Create public handle
  const handle: ChannelHandle = {
    // Properties for registry compatibility
    id: state.id,
    name: state.name,
    target: state.target,

    // Methods
    getId: () => state.id,
    getName: () => state.name,
    getTarget: () => state.target,
    isActive: () => state.active,
    toJSON: (): ChannelJSON => ({
      id: state.id,
      name: state.name,
      active: state.active,
      origin: state.origin,
      connectTimestamp: state.connectTimestamp,
      contract: state.contract,
      queuedMessagesCount: state.queuedMessages.length,
    }),

    connect: () => connect(internals),
    disconnect: (notify) => disconnect(internals, notify),
    cancel: (notify) => cancel(internals, notify),
    destroy: (notify) => destroy(internals, notify),

    send: (type, data) => send(internals, { type, data }),
    sendAction: (action: unknown) => sendActionImpl(internals, <IAction>action),

    on: (handler) => subscribeToEvents(internals, handler),
    onMessage: (handler) => subscribeToMessages(internals, handler),

    // Broker-internal methods
    activate: (origin: string, contract: IChannelContract) => {
      const newState = activateState(state, origin, contract)
      internals.updateState(newState)
    },

    isReadyToConnect: () => {
      // Channel is ready if connect() has been called (readyToConnect is true)
      // OR if it's broker-managed (auto-activates)
      return state.readyToConnect || state.brokerManaged
    },

    scheduleActivation: (senderId: string, origin: string, contract: IChannelContract, processId: string) => {
      internals.updateState({
        scheduledActivation: [senderId, origin, contract, processId] as const,
      })
    },

    notifyEvent: (event: ChannelEvent, data?: unknown) => {
      notifyEvent(internals, event, data)
    },

    notifyMessage: (message: IMessage) => {
      notifyMessage(internals, message)
    },
  }

  return handle
}
