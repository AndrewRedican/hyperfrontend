import type { ChannelInternals } from '../types'
import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { beginResponse } from './begin-response'
import { expireHandshake, startHandshakeTimers } from './handshake-timers'

/**
 * Initiates the connection handshake for a channel.
 *
 * - If the channel is already open or mid-handshake, does nothing
 * - If a REQUEST arrived before connect() (scheduled activation), answers it
 *   as the responder: sends ACCEPT and waits for OPEN
 * - Otherwise acts as the initiator: sends REQUEST, re-sends it every
 *   `requestRetryMs`, and fires 'connect-timeout' if no ACCEPT arrives within
 *   `connectTimeoutMs`
 *
 * The channel becomes active only when the wire handshake completes; after
 * a 'connect-timeout' the channel stays inactive with queued messages retained, and
 * connect() may be called again.
 *
 * @param channel - Channel internals with state and dependencies
 *
 * @example Initiating a connection
 * ```typescript
 * connect(channel) // Sends REQUEST_CONNECTION or answers a pending request
 * ```
 */
export function connect(channel: ChannelInternals): void {
  const state = channel.getState()

  if (state.active || state.pendingProcessId || state.pendingAccept) {
    return
  }

  if (!state.readyToConnect) {
    channel.updateState({ readyToConnect: true })
  }

  if (!state.connectTimestamp) {
    channel.updateState({ connectTimestamp: dateNow() })
  }

  if (state.scheduledActivation) {
    beginResponse(channel, state.scheduledActivation, channel.actions.acceptConnection(state.scheduledActivation[3]))
    return
  }

  const processId = channel.createProcess()
  channel.updateState({ pendingProcessId: processId })
  const requestAction = channel.actions.requestConnection(processId)
  // why: Timers start before the send so a synchronously delivered ACCEPT finds them registered and clears them.
  startHandshakeTimers(channel, requestAction, () => expireHandshake(channel, processId))
  channel.sendAction(requestAction)
}
