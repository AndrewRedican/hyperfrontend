/**
 * Minimal channel structure required for registry operations.
 * Extended with optional methods for use with full ChannelHandle objects.
 */
import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { createWeakMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/weak-map'

/**
 * Minimal channel structure required for registry operations.
 */
export interface MinimalChannel {
  /** Unique channel identifier */
  id: string
  /** Channel name */
  name: string
  /** Target window for the channel */
  target: Window
  /** Returns whether the channel is active */
  isActive?: () => boolean
  /** Returns the currently pinned origin ('*' or null when unpinned) */
  getOrigin?: () => string | null
  /** Sends an action through the channel */
  sendAction?: (action: unknown) => void
  /** Destroys the channel */
  destroy?: (notify?: boolean) => void
  /** Cancels the channel */
  cancel?: (notify?: boolean) => void
  /** Disconnects the channel */
  disconnect?: (notify?: boolean) => void
  /** Notifies an event with optional data */
  notifyEvent?: (event: unknown, data?: unknown) => void
  /** Notifies a message */
  notifyMessage?: (message: unknown) => void
}

/**
 * Registry interface for managing channels.
 */
export interface ChannelRegistry {
  /** Adds a channel to the registry */
  add: (channel: MinimalChannel) => void
  /** Removes a channel from the registry */
  remove: (channel: MinimalChannel) => void
  /** Gets a channel by its target window */
  getByWindow: (target: Window) => MinimalChannel | undefined
  /** Gets a channel by its ID */
  getById: (id: string) => MinimalChannel | undefined
  /** Gets a channel by its name */
  getByName: (name: string) => MinimalChannel | undefined
  /** Gets all channels in the registry */
  getAll: () => MinimalChannel[]
  /** Clears all channels from the registry */
  clear: () => void
}

/** Alias for ChannelRegistry */
export type Registry = ChannelRegistry

/**
 * Creates a new channel registry with isolated state.
 * All lookup operations are O(1) using WeakMap/Map.
 *
 * @returns Registry functions for managing channels
 *
 * @example Creating and using a registry
 * ```typescript
 * const registry = createRegistry()
 * registry.add({ id: 'ch-1', name: 'main', target: iframe.contentWindow })
 * const channel = registry.getById('ch-1')
 * ```
 */
export function createRegistry(): ChannelRegistry {
  const windowMap = createWeakMap<Window, MinimalChannel>()
  const idMap = createMap<string, MinimalChannel>()
  const nameMap = createMap<string, MinimalChannel>()
  const channels = createSet<MinimalChannel>()

  return freeze({
    add: (channel: MinimalChannel) => {
      if (!channel || !channel.id || !channel.name || !channel.target) {
        throw createError('Invalid channel: must have id, name, and target properties')
      }

      channels.add(channel)
      windowMap.set(channel.target, channel)
      idMap.set(channel.id, channel)
      nameMap.set(channel.name, channel)
    },

    remove: (channel: MinimalChannel) => {
      if (!channel) return

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
    },
  })
}
