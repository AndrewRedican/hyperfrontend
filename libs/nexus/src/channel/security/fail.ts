import type { SecurityTransportError } from '../../types/security'
import type { ChannelInternals } from '../types'
import { cancel } from '../lifecycle/cancel'
import { disconnect } from '../lifecycle/disconnect'
import { dropSecurityTransport } from './drop'

/**
 * Terminates a connection whose secure session can no longer be confirmed.
 *
 * An active connection closes silently with reason `'security-unconfirmed'`:
 * no close frame travels, because nothing but the handshake may cross the
 * wire in plaintext once a transport is attached, and the session keys were
 * never confirmed. A connection still awaiting the initiator's OPEN is
 * cancelled and the counterpart told so, and a `deny` event with reason
 * `'security-unavailable'` reports the outcome locally.
 *
 * @param channel - Channel internals with state and dependencies
 * @param error - The failure that ended the session
 *
 * @example Reacting to the confirmation deadline
 * ```typescript
 * failSecurity(internals, { code: 'security-unconfirmed', message: 'no confirmation within 10000ms' })
 * ```
 */
export function failSecurity(channel: ChannelInternals, error: SecurityTransportError): void {
  const state = channel.getState()

  if (state.active) {
    disconnect(channel, false, 'security-unconfirmed')
    return
  }

  const pending = state.pendingAccept
  dropSecurityTransport(channel)

  if (pending === null) {
    return
  }

  cancel(channel, false)
  channel.sendAction(channel.actions.cancelConnection(pending[3]))
  channel.notifyEvent('deny', {
    error: error.message,
    reason: 'security-unavailable',
    ...(state.origin !== null && { origin: state.origin }),
  })
}
