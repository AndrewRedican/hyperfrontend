import type { IAction } from '../types/action'
import type { IChannelConfig, ChannelHandle, ChannelJSON, EventHandler } from '../types/channel'
import type { IChannelContract } from '../types/contract'
import type { ChannelEvent, EventCallbackMap } from '../types/events'
import type { IMessage } from '../types/message'
import type { SecurityProtocolVersion, SecurityTransport, SecurityNegotiationRequest, SecurityNegotiationResponse } from '../types/security'
import type { ChannelInternals, ChannelDependencies } from './types'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { assertNoCircularRef } from '../utils/validation/assert-no-circular-ref'
import { DEFAULT_CHANNEL_SETTINGS } from './defaults'
import { abandonRequest } from './lifecycle/abandon-request'
import { beginResponse } from './lifecycle/begin-response'
import { cancel } from './lifecycle/cancel'
import { completeConnection } from './lifecycle/complete-connection'
import { completeScheduledOpen } from './lifecycle/complete-open'
import { connect } from './lifecycle/connect'
import { destroy } from './lifecycle/destroy'
import { disconnect } from './lifecycle/disconnect'
import { flush } from './messaging/flush'
import { send } from './messaging/send'
import { sendAction as sendActionImpl } from './messaging/send-action'
import { activate as activateState } from './state/activate'
import { createInitialState } from './state/initial'
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
 * @example Creating and using a channel
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
  assertNoCircularRef(config.settings, 'config.settings')

  const settings = { ...DEFAULT_CHANNEL_SETTINGS, ...config.settings }

  let state = createInitialState(config.name, config.target, settings)

  const internals: ChannelInternals = {
    getState: () => state,

    updateState: (partial) => {
      state = { ...state, ...partial }
    },

    sendAction: (action: IAction) => {
      sendActionImpl(internals, action)
    },

    createProcess: () => {
      // why: Routing handlers look processes up and call ChannelHandle methods on the result, so processes must map to the public handle.
      return deps.processManager.create(handle)
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

  const handle: ChannelHandle = {
    id: state.id,
    name: state.name,
    target: state.target,

    getId: () => state.id,
    getName: () => state.name,
    getTarget: () => state.target,
    isActive: () => state.active,
    isClosing: () => typeof state.closingProcessId === 'string',
    getOrigin: () => state.origin,
    getPeerId: () => state.peerId,
    getPeerContract: () => state.peerContract,
    getPendingProcessId: () => state.pendingProcessId,
    getAcceptedTypes: () => state.acceptedActions,
    toJSON: (): ChannelJSON => ({
      id: state.id,
      name: state.name,
      active: state.active,
      origin: state.origin,
      connectTimestamp: state.connectTimestamp,
      contract: state.contract,
      peerContract: state.peerContract,
      peerId: state.peerId,
      queuedMessagesCount: state.queuedMessages.length,
    }),

    connect: () => connect(internals),
    disconnect: (notify) => disconnect(internals, notify),
    endStaleSession: () => disconnect(internals, false, 'peer-reload'),
    cancel: (notify) => cancel(internals, notify),
    destroy: (notify) => destroy(internals, notify),

    // why: A payload-less send must omit the data key entirely — an explicit `data: undefined` fails the security envelope's serializability validation, which rejects undefined anywhere in the message.
    send: (type, data) => send(internals, data === undefined ? { type } : { type, data }),
    sendAction: (action: unknown) => sendActionImpl(internals, <IAction>action),

    on: <E extends ChannelEvent>(eventOrHandler: E | EventHandler, handler?: EventCallbackMap[E]) => {
      if (typeof eventOrHandler === 'string' && typeof handler === 'function') {
        return subscribeToEvents(internals, eventOrHandler, handler)
      }
      return subscribeToEvents(internals, <EventHandler>eventOrHandler)
    },
    onMessage: (handler) => subscribeToMessages(internals, handler),

    activate: (origin: string, peerContract: IChannelContract, peerId?: string) => {
      const newState = activateState(state, origin, peerContract, peerId ?? null)
      internals.updateState(newState)
    },

    beginResponse: (senderId: string, origin: string, contract: IChannelContract, processId: string, acceptAction: IAction) => {
      beginResponse(internals, <const>[senderId, origin, contract, processId], acceptAction)
    },

    abandonRequest: () => {
      abandonRequest(internals)
    },

    completeConnection: (origin: string, peerContract: IChannelContract, peerId: string, replyAction: IAction) => {
      completeConnection(internals, origin, peerContract, peerId, replyAction)
    },

    completeScheduledOpen: () => {
      return completeScheduledOpen(internals)
    },

    isReadyToConnect: () => {
      return state.readyToConnect
    },

    isAwaitingOpen: () => {
      return state.pendingAccept !== null
    },

    getSecuritySettings: () => {
      return state.security
    },

    applySecuritySettings: (securitySettings) => {
      // why: First write wins — settings supplied at creation (or an earlier registration) stay authoritative over later ones.
      if (state.security === null) {
        internals.updateState({ security: securitySettings })
      }
    },

    getContractCompat: () => {
      return state.contractCompat
    },

    scheduleActivation: (
      senderId: string,
      origin: string,
      contract: IChannelContract,
      processId: string,
      security?: SecurityNegotiationResponse
    ) => {
      internals.updateState({
        scheduledActivation: <const>[senderId, origin, contract, processId, security],
      })
    },

    notifyEvent: (event: ChannelEvent, data?: unknown) => {
      notifyEvent(internals, event, data)
    },

    notifyMessage: (message: IMessage) => {
      notifyMessage(internals, message)
    },

    markDenyNotified: (processId: string) => {
      if (state.notifiedDenyProcessId === processId) {
        return false
      }
      internals.updateState({ notifiedDenyProcessId: processId })
      return true
    },

    setPendingSecurityRequest: (request: SecurityNegotiationRequest | null) => {
      internals.updateState({ pendingSecurityRequest: request })
    },

    getPendingSecurityRequest: () => {
      return state.pendingSecurityRequest
    },

    setNegotiatedProtocol: (protocol: SecurityProtocolVersion) => {
      internals.updateState({ negotiatedProtocol: protocol })
    },

    getNegotiatedProtocol: () => {
      return state.negotiatedProtocol
    },

    setSecurityTransport: (transport: SecurityTransport | null) => {
      internals.updateState({ securityTransport: transport })
    },

    getSecurityTransport: () => {
      return state.securityTransport
    },

    setSecurityReady: (ready: boolean) => {
      internals.updateState({ securityReady: ready })
      // why: Messages queued while an external transport reported not-ready must flush through it as soon as readiness is signalled.
      if (ready && state.active && state.queuedMessages.length > 0) {
        flush(internals)
      }
    },

    isSecurityReady: () => {
      return state.securityReady
    },
  }

  return freeze(handle)
}
