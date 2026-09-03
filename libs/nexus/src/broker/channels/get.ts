import type { createChannel } from '../../channel/factory'
import type { Registry } from '../../core/registry/factory'
import { getById } from '../../core/registry/get-by-id'
import { getByName } from '../../core/registry/get-by-name'
import { getByWindow } from '../../core/registry/get-by-window'

/**
 * Gets a channel by reference (id, name, or window)
 *
 * @param registry - Channel registry containing all registered channels
 * @param reference - Channel identifier (id, name, or window object)
 * @returns The channel if found, null otherwise
 *
 * @example Retrieving channels by name or window
 * ```typescript
 * const channelByName = getChannel(registry, 'widget-channel')
 * const channelByWindow = getChannel(registry, iframe.contentWindow)
 * ```
 */
export function getChannel(registry: Registry, reference: string | Window): ReturnType<typeof createChannel> | null {
  if (typeof reference === 'object' && reference !== null) {
    const channel = getByWindow(registry, reference as Window)
    return (channel as unknown as ReturnType<typeof createChannel>) ?? null
  }

  if (typeof reference === 'string') {
    const channel = getById(registry, reference) ?? getByName(registry, reference)
    return (channel as unknown as ReturnType<typeof createChannel>) ?? null
  }

  return null
}
