import type { IAction } from '../../types/action'
import type { ChannelInternals } from '../types'
import { clearInterval, clearTimeout, setInterval, setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'

/**
 * Starts the handshake retry and deadline timers for a pending connection.
 *
 * The retry timer re-sends the given handshake action at the channel's
 * `requestRetryMs` cadence; the deadline timer aborts the attempt after
 * `connectTimeoutMs`. Any previously running handshake timers are cleared
 * first so at most one attempt is timed per channel.
 *
 * @param channel - Channel internals with state and dependencies
 * @param replayAction - Handshake action to re-send on every retry tick
 * @param onDeadline - Callback invoked once when the deadline expires
 *
 * @example Timing an outbound connection request
 * ```typescript
 * startHandshakeTimers(channel, requestAction, () => expireHandshake(channel, processId))
 * ```
 */
export function startHandshakeTimers(channel: ChannelInternals, replayAction: IAction, onDeadline: () => void): void {
  clearHandshakeTimers(channel)

  const state = channel.getState()
  channel.updateState({
    retryTimer: setInterval(() => channel.sendAction(replayAction), state.requestRetryMs),
    deadlineTimer: setTimeout(onDeadline, state.connectTimeoutMs),
  })
}

/**
 * Clears the handshake retry and deadline timers, if running.
 *
 * Safe to call on any teardown path; does nothing when no timers are set.
 *
 * @param channel - Channel internals with state and dependencies
 *
 * @example Stopping handshake timers on teardown
 * ```typescript
 * clearHandshakeTimers(channel)
 * ```
 */
export function clearHandshakeTimers(channel: ChannelInternals): void {
  const state = channel.getState()

  if (state.retryTimer !== null) {
    clearInterval(state.retryTimer)
  }
  if (state.deadlineTimer !== null) {
    clearTimeout(state.deadlineTimer)
  }
  if (state.retryTimer !== null || state.deadlineTimer !== null) {
    channel.updateState({ retryTimer: null, deadlineTimer: null })
  }
}

/**
 * Expires a pending handshake when the connection deadline is reached.
 *
 * Clears the timers, removes the pending process, resets the pending
 * handshake state, and fires the 'connect-timeout' event. The channel remains
 * inactive with its queued messages retained, and `connect()` may be
 * called again to start a fresh attempt.
 *
 * @param channel - Channel internals with state and dependencies
 * @param processId - Process id of the expired connection attempt
 *
 * @example Wiring the deadline callback
 * ```typescript
 * startHandshakeTimers(channel, action, () => expireHandshake(channel, processId))
 * ```
 */
export function expireHandshake(channel: ChannelInternals, processId: string): void {
  clearHandshakeTimers(channel)
  channel.removeProcess(processId)
  channel.updateState({ pendingProcessId: null, pendingAccept: null })
  channel.notifyEvent('connect-timeout', { elapsedMs: channel.getState().connectTimeoutMs })
}
