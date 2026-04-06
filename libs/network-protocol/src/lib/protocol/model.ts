import type { ProtocolProvider } from '../channel/model'

/**
 * Entry in a protocol provider store, associating a provider with identifiers.
 */
export interface ProtocolProviderEntry<T = unknown> {
  /** Unique identifier for this entry */
  readonly id: string
  /** Human-readable name for this provider */
  readonly name: string
  /** The protocol provider instance */
  readonly provider: ProtocolProvider<T>
}

/**
 * Store for managing protocol providers with lookup by name or ID.
 */
export interface ProtocolProviderStore<T = unknown> {
  /** Registers a new provider with the given name */
  readonly add: (name: string, protocolProvider: ProtocolProvider<T>) => void
  /** Checks if a provider exists by name */
  readonly existsByName: (name: string) => boolean
  /** Checks if a provider exists by ID */
  readonly existsById: (id: string) => boolean
  /** Removes providers by name */
  readonly removeByName: (...name: string[]) => void
  /** Removes providers by ID */
  readonly removeById: (...id: string[]) => void
  /** Removes all providers */
  readonly clear: () => void
  /** Retrieves a provider by name */
  readonly getByName: (name: string) => ProtocolProvider<T> | null
  /** Retrieves a provider by ID */
  readonly getById: (id: string) => ProtocolProvider<T> | null
  /** List of all registered provider entries */
  readonly list: readonly ProtocolProviderEntry<T>[]
}
