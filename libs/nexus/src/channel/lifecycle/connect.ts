import type { ChannelInternals } from '../types'
import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { flush } from '../messaging/flush'

/**
 * Initiates the connection handshake for a channel.
 *
 * - If channel is already open, does nothing
 * - If channel has a scheduled activation (pending connection), accepts it
 * - Otherwise, sends REQUEST_CONNECTION to initiate handshake
 *
 * @param channel - Channel internals with state and dependencies
 *
 * @example
 * ```typescript
 * connect(channel) // Sends REQUEST_CONNECTION or accepts pending
 * ```
 */
export function connect(channel: ChannelInternals): void {
  const state = channel.getState()

  // Don't connect if already active
  if (state.active) {
    return
  }

  // Mark as ready to connect (for broker's REQUEST handler)
  if (!state.readyToConnect) {
    channel.updateState({ readyToConnect: true })
  }

  // Set connect timestamp if not already set
  if (!state.connectTimestamp) {
    channel.updateState({ connectTimestamp: dateNow() })
  }

  // If we have a scheduled activation, accept it
  if (state.scheduledActivation) {
    const [senderId, origin, contract, processId] = state.scheduledActivation

    // Activate the channel
    channel.updateState({
      id: senderId,
      origin,
      contract,
      acceptedActions: contract.accepted.map((a) => a.type),
      active: true,
      scheduledActivation: null,
    })

    // Send acceptance
    const acceptAction = channel.actions.acceptConnection(processId)
    channel.sendAction(acceptAction)

    // Notify subscribers
    channel.notifyEvent('open', { id: senderId, origin })

    return
  }

  // Auto-activate broker-managed channels (same-context scenario)
  if (state.brokerManaged && state.contract) {
    channel.updateState({
      origin: '*',
      active: true,
      acceptedActions: state.contract.accepted.map((a) => a.type),
    })

    // Notify subscribers
    channel.notifyEvent('open', { id: state.id, origin: '*' })

    // Flush any queued messages
    flush(channel)

    return
  }

  // Create a new connection process
  const processId = channel.createProcess()
  const requestAction = channel.actions.requestConnection(processId)
  channel.sendAction(requestAction)
}
