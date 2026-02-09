import type { ChannelInternals } from '../types'
import type { IAction } from '../../types/action'
import { ACTION_TYPES } from '../../constants/action-types'

/**
 * Action types that should always be sent in plaintext.
 *
 * Handshake actions must remain unencrypted because:
 * - Security negotiation happens during handshake
 * - Both parties need to read handshake messages before security is established
 */
const PLAINTEXT_ACTION_TYPES: Set<string> = new Set([
  ACTION_TYPES.REQUEST_CONNECTION,
  ACTION_TYPES.ACCEPT_CONNECTION,
  ACTION_TYPES.DENY_CONNECTION,
  ACTION_TYPES.CANCEL_CONNECTION,
  ACTION_TYPES.CANCEL_CONNECTION_ACKNOWLEDGED,
  ACTION_TYPES.OPEN_CONNECTION,
])

/**
 * Sends a raw action to the channel's target window.
 *
 * This function routes actions through the security transport when:
 * - The channel has a security transport configured
 * - The security transport is ready
 * - The action type is not a handshake action (handshakes are always plaintext)
 *
 * For secure protocols (v1/v2), the action is encrypted and sent as Uint8Array.
 * For 'none' protocol or handshake actions, the action is sent as plain object.
 *
 * @param channel - Channel internals with state and dependencies
 * @param action - Action to send
 *
 * @example
 * ```typescript
 * const action = channel.actions.requestConnection(processId)
 * sendAction(channel, action)
 * ```
 */
export function sendAction(channel: ChannelInternals, action: IAction): void {
  const state = channel.getState()

  if (!action || typeof action.type !== 'string') {
    throw new Error("Action must contain a 'type' property that is a non-empty string.")
  }

  const securityTransport = state.securityTransport
  const isHandshakeAction = PLAINTEXT_ACTION_TYPES.has(action.type)

  if (securityTransport && securityTransport.isReady() && !isHandshakeAction) {
    securityTransport.send(action)
    return
  }

  state.target.postMessage(action, '*')
}
