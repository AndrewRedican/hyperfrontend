import type { ChannelRegistry, MinimalChannel } from '../../core/registry/factory'
import type { IAction } from '../../types/action'

/**
 * Resolves the local channel an inbound action belongs to.
 *
 * The source window of the message event is the authoritative identity of
 * the counterpart, so the lookup is window-first. When the event has no
 * source (for example after the sending window was closed), the lookup
 * falls back to the sender id declared on the action.
 *
 * @param registry - Channel registry of the receiving broker
 * @param message - Message event carrying the inbound action
 * @returns The matching channel, or undefined when no channel is registered for the sender
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
  if (source) {
    const channel = registry.getByWindow(<Window>source)
    if (channel) {
      return channel
    }
  }
  return registry.getById(message.data.senderId)
}
