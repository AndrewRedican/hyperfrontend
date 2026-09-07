import type { ChannelInternals } from '../types'

/**
 * Releases the channel's security transport, if it has one.
 *
 * The transport's timers are cleared and it refuses further work before the
 * channel forgets it; frames already sealed or sealing still leave.
 *
 * @param channel - Channel internals with state and dependencies
 *
 * @example Releasing the transport when a session ends
 * ```typescript
 * dropSecurityTransport(internals)
 * ```
 */
export function dropSecurityTransport(channel: ChannelInternals): void {
  const transport = channel.getState().securityTransport
  if (transport === null) {
    return
  }
  transport.dispose()
  channel.updateState({ securityTransport: null })
}
