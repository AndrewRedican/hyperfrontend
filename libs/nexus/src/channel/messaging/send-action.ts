import type { IAction } from '../../types/action'
import type { ChannelInternals } from '../types'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { HANDSHAKE_ACTION_TYPES } from '../../constants/handshake-actions'

/**
 * Sends a raw action to the channel's target window.
 *
 * Handshake actions are always posted in plaintext. Every other action is
 * routed through the channel's security transport when one is attached,
 * leaving the window as a sealed `Uint8Array` frame once the session is
 * keyed; without a transport it is posted as a plain object.
 *
 * @param channel - Channel internals with state and dependencies
 * @param action - Action to send
 *
 * @example Sending an action to the target window
 * ```typescript
 * const action = channel.actions.requestConnection(processId)
 * sendAction(channel, action)
 * ```
 */
export function sendAction(channel: ChannelInternals, action: IAction): void {
  const state = channel.getState()

  if (!action || typeof action.type !== 'string') {
    throw createError("Action must contain a 'type' property that is a non-empty string.")
  }

  const securityTransport = state.securityTransport

  if (securityTransport && !HANDSHAKE_ACTION_TYPES.has(action.type)) {
    securityTransport.send(action)
    return
  }

  // why: Sends target the pinned origin once learned; '*' covers the pre-pin window and opaque ('null') origins, which postMessage cannot target.
  state.target.postMessage(action, state.origin === null || state.origin === 'null' ? '*' : state.origin)
}
