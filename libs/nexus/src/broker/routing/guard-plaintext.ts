import type { IAction } from '../../types/action'
import type { ChannelHandle } from '../../types/channel'
import type { RoutingContext } from './types'
import { HANDSHAKE_ACTION_TYPES } from '../../constants/handshake-actions'

/**
 * Decides whether a plaintext action may enter the router.
 *
 * Once a channel has a security transport, every action but the handshake
 * ones must arrive sealed; a plaintext copy is a bypass attempt (or a
 * counterpart that lost its transport) and is dropped with an `invalid`
 * event before any handler sees it. Actions for windows without a channel,
 * or for channels without a transport, pass through to the handlers.
 *
 * @param context - Routing context with state, registry, actions, and logger
 * @param event - Incoming plaintext message event
 * @returns True when the action may be routed; false when it was dropped
 *
 * @example Gating wire events before routing
 * ```typescript
 * if (isPlaintextAllowed(routingContext, event)) {
 *   routeMessage(router, routingContext, event)
 * }
 * ```
 */
export function isPlaintextAllowed(context: RoutingContext, event: MessageEvent<IAction>): boolean {
  const { state, registry, logger } = context
  const action = event?.data
  const type = action?.type

  if (typeof type !== 'string' || HANDSHAKE_ACTION_TYPES.has(type)) {
    return true
  }

  const source = event.source
  const channel = source ? (registry.getByWindow(source as Window) as ChannelHandle | undefined) : undefined

  if (!channel || channel.getSecurityTransport() === null) {
    return true
  }

  logger.warn(`${state.name} dropped a plaintext '${type}' action: the ${channel.getName()} channel is secured.`)
  channel.notifyEvent('invalid', { error: `Dropped plaintext '${type}' action: the channel is secured.`, action })
  return false
}
