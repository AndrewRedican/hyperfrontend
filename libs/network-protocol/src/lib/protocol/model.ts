import type { ProtocolProvider } from '../channel/model'

export interface ProtocolProviderEntry<T = unknown> {
  readonly id: string
  readonly name: string
  readonly provider: ProtocolProvider<T>
}

export interface ProtocolProviderStore<T = unknown> {
  readonly add: (name: string, protocolProvider: ProtocolProvider<T>) => void
  readonly existsByName: (name: string) => boolean
  readonly existsById: (id: string) => boolean
  readonly removeByName: (...name: string[]) => void
  readonly removeById: (...id: string[]) => void
  readonly clear: () => void
  readonly getByName: (name: string) => ProtocolProvider<T> | null
  readonly getById: (id: string) => ProtocolProvider<T> | null
  readonly list: readonly ProtocolProviderEntry<T>[]
}
