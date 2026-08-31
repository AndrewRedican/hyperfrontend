import type { ChannelRegistry, MinimalChannel } from '../../core/registry/factory'
import type { IAction } from '../../types/action'

/**
 * Resolves the local channel an inbound action belongs to.
 *
 * The source window of the message event is the sole identity of the
 * counterpart: sender ids declared on the action are attacker-suppliable
 * and are never used for lookup. When the resolved channel has a pinned
 * origin, the event origin must match or the message is dropped before
 * any handler runs.
 *
 * @param registry - Channel registry of the receiving broker
 * @param message - Message event carrying the inbound action
 * @returns The matching channel, or undefined when no channel is registered
 * for the source window or the pinned origin does not match
 *
 * @example Resolving the channel for an inbound action
 * ```typescript
 * const channel = resolveChannel(registry, event)
 * if (channel) {
 *   channel.notifyMessage(event.data.data)
 * }
 * ```
 */
export function resolveChannel(registry: ChannelRegistry, message: MessageEvent<IAction>): MinimalChannel | undefined {
  const source = message.source
  if (!source) {
    return undefined
  }

  const channel = registry.getByWindow(source as Window)
  if (!channel) {
    return undefined
  }

  const pinnedOrigin = channel.getOrigin?.() ?? null
  if (pinnedOrigin !== null && pinnedOrigin !== '*' && pinnedOrigin !== message.origin) {
    return undefined
  }

  return channel
}
