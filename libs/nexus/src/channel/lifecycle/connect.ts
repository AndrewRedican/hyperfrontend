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

  if (state.active) {
    return
  }

  if (!state.readyToConnect) {
    channel.updateState({ readyToConnect: true })
  }

  if (!state.connectTimestamp) {
    channel.updateState({ connectTimestamp: dateNow() })
  }

  if (state.scheduledActivation) {
    const [senderId, origin, contract, processId] = state.scheduledActivation

    channel.updateState({
      id: senderId,
      origin,
      contract,
      acceptedActions: contract.accepted.map((a) => a.type),
      active: true,
      scheduledActivation: null,
    })

    const acceptAction = channel.actions.acceptConnection(processId)
    channel.sendAction(acceptAction)

    channel.notifyEvent('open', { id: senderId, origin })

    return
  }

  if (state.brokerManaged && state.contract) {
    channel.updateState({
      origin: '*',
      active: true,
      acceptedActions: state.contract.accepted.map((a) => a.type),
    })

    channel.notifyEvent('open', { id: state.id, origin: '*' })

    flush(channel)

    return
  }

  const processId = channel.createProcess()
  const requestAction = channel.actions.requestConnection(processId)
  channel.sendAction(requestAction)
}
