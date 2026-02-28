/**
 * Minimal channel structure required for registry operations.
 * Extended with optional methods for use with full ChannelHandle objects.
 */
import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'

export interface MinimalChannel {
  id: string
  name: string
  target: Window
  // Optional methods for full channel support
  isActive?: () => boolean
  sendAction?: (action: unknown) => void
  destroy?: (notify?: boolean) => void
  cancel?: (notify?: boolean) => void
  disconnect?: (notify?: boolean) => void
  notifyEvent?: (event: unknown, data?: unknown) => void
  notifyMessage?: (message: unknown) => void
}

export interface ChannelRegistry {
  add: (channel: MinimalChannel) => void
  remove: (channel: MinimalChannel) => void
  getByWindow: (target: Window) => MinimalChannel | undefined
  getById: (id: string) => MinimalChannel | undefined
  getByName: (name: string) => MinimalChannel | undefined
  getAll: () => MinimalChannel[]
  clear: () => void
}

// Export type alias for convenience
export type Registry = ChannelRegistry

/**
 * Creates a new channel registry with isolated state.
 * All lookup operations are O(1) using WeakMap/Map.
 *
 * @returns Registry functions for managing channels
 */
export function createRegistry(): ChannelRegistry {
  // Private state using closures
  const windowMap = new WeakMap<Window, MinimalChannel>()
  const idMap = new Map<string, MinimalChannel>()
  const nameMap = new Map<string, MinimalChannel>()
  const channels = new Set<MinimalChannel>()

  return {
    add: (channel: MinimalChannel) => {
      if (!channel || !channel.id || !channel.name || !channel.target) {
        throw new Error('Invalid channel: must have id, name, and target properties')
      }

      // Add to all lookup structures
      channels.add(channel)
      windowMap.set(channel.target, channel)
      idMap.set(channel.id, channel)
      nameMap.set(channel.name, channel)
    },

    remove: (channel: MinimalChannel) => {
      if (!channel) return

      // Remove from all lookup structures
      channels.delete(channel)
      if (channel.target) windowMap.delete(channel.target)
      if (channel.id) idMap.delete(channel.id)
      if (channel.name) nameMap.delete(channel.name)
    },

    getByWindow: (target: Window) => {
      return windowMap.get(target)
    },

    getById: (id: string) => {
      return idMap.get(id)
    },

    getByName: (name: string) => {
      return nameMap.get(name)
    },

    getAll: () => {
      return from(channels)
    },

    clear: () => {
      channels.clear()
      idMap.clear()
      nameMap.clear()
      // WeakMap doesn't have clear, but clearing references is enough
    },
  }
}
