import type { CloseReason } from '../../types/events'
import type { ChannelInternals } from '../types'
import { clearTimeout, setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { clearHandshakeTimers } from './handshake-timers'

/**
 * Completes a close on this side: stops timers, deactivates the channel,
 * resets the negotiated security state, and fires a single 'close' event.
 *
 * Runs when a polite close is acknowledged (or its deadline expires), or
 * immediately for a silent close. Safe to call on any teardown path; does
 * nothing when the channel is already inactive.
 *
 * @param channel - Channel internals with state and dependencies
 * @param reason - Why the session ended, when neither side asked for the close
 *
 * @example Completing a close once the counterpart acknowledges
 * ```typescript
 * finalizeClose(channel)
 * ```
 */
export function finalizeClose(channel: ChannelInternals, reason?: CloseReason): void {
  const state = channel.getState()

  if (!state.active) {
    return
  }

  clearHandshakeTimers(channel)
  clearCloseTimer(channel)

  // why: The 'close' payload reports whether the counterpart was told — true exactly when this side sent CLOSE (a polite close it initiated).
  const notified = typeof state.closingProcessId === 'string'
  if (typeof state.closingProcessId === 'string') {
    channel.removeProcess(state.closingProcessId)
  }

  // why: The next handshake renegotiates security from scratch; a transport kept across connections would encrypt to a peer that may no longer decrypt.
  channel.updateState({
    active: false,
    pendingProcessId: null,
    pendingAccept: null,
    closingProcessId: null,
    negotiatedProtocol: null,
    securityReady: false,
    securityTransport: null,
    pendingSecurityRequest: null,
  })

  channel.notifyEvent('close', { notify: notified, ...(reason && { reason }) })
}

/**
 * Clears the close-acknowledgement deadline timer, if running.
 *
 * @param channel - Channel internals with state and dependencies
 *
 * @example Stopping the close deadline on teardown
 * ```typescript
 * clearCloseTimer(channel)
 * ```
 */
export function clearCloseTimer(channel: ChannelInternals): void {
  const state = channel.getState()

  if (state.closeTimer !== null && state.closeTimer !== undefined) {
    clearTimeout(state.closeTimer)
    channel.updateState({ closeTimer: null })
  }
}

/**
 * Gracefully closes an active channel connection.
 *
 * A notifying close is a polite exchange: this side posts CLOSE, fires a
 * 'closing' event, and stays active so the counterpart's final flush
 * messages still deliver. The single 'close' event fires once the
 * counterpart acknowledges, or once `closeTimeoutMs` expires, so an
 * unresponsive counterpart cannot hold the channel open. A silent close
 * (`notify = false`) completes immediately.
 *
 * - Only works if channel is currently active
 * - Detaches the security transport and clears the negotiated protocol so a
 *   later handshake starts from a clean security state
 * - Fires 'close' to subscribers exactly once per close
 *
 * @param channel - Channel internals with state and dependencies
 * @param notify - Whether to notify target window (default: true)
 * @param reason - Why the session ended, when neither side asked for the close
 *
 * @example Gracefully closing a connection
 * ```typescript
 * disconnect(channel, true) // Propose close, await acknowledgement
 * disconnect(channel, false) // Close silently and immediately
 * ```
 */
export function disconnect(channel: ChannelInternals, notify = true, reason?: CloseReason): void {
  const state = channel.getState()

  if (!state.active) {
    return
  }

  if (typeof state.closingProcessId === 'string') {
    // why: A repeated polite close while one is in flight must not send a second CLOSE; a silent close during the wait completes it now (acknowledgement or forced teardown).
    if (!notify) {
      finalizeClose(channel, reason)
    }
    return
  }

  if (!notify) {
    finalizeClose(channel, reason)
    return
  }

  clearHandshakeTimers(channel)

  const processId = channel.createProcess()
  const closeAction = channel.actions.closeConnection(processId)

  channel.updateState({
    closingProcessId: processId,
    closeTimer: setTimeout(() => finalizeClose(channel), state.closeTimeoutMs),
  })

  channel.sendAction(closeAction)
  channel.notifyEvent('closing', { initiatedLocally: true })
}
