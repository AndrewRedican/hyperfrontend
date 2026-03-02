import type { Registry } from '../../core/registry/factory'
import { createChannel } from '../../channel/factory'
import { getById } from '../../core/registry/get-by-id'
import { getByName } from '../../core/registry/get-by-name'
import { getByWindow } from '../../core/registry/get-by-window'

/**
 * Gets a channel by reference (id, name, or window)
 *
 * @param registry - Channel registry containing all registered channels
 * @param reference - Channel identifier (id, name, or window object)
 * @returns The channel if found, null otherwise
 */
export function getChannel(registry: Registry, reference: string | Window): ReturnType<typeof createChannel> | null {
  // Window lookup - check if it's an object (Window-like) and not a string
  if (typeof reference === 'object' && reference !== null) {
    const channel = getByWindow(registry, <Window>reference)
    return <ReturnType<typeof createChannel>>(<unknown>channel) ?? null
  }

  // String lookup - try ID first, then name
  if (typeof reference === 'string') {
    const channel = getById(registry, reference) ?? getByName(registry, reference)
    return <ReturnType<typeof createChannel>>(<unknown>channel) ?? null
  }

  return null
}
