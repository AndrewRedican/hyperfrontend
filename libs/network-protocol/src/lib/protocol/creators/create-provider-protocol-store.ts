import type { ProtocolProvider } from '../../channel/model'
import type { ProtocolProviderStore, ProtocolProviderEntry } from '../model'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { uuidV4 } from '@hyperfrontend/random-generator-utils'
import { isValidName } from '../validations/is-valid-name'

/**
 * Creates a store for managing protocol provider registrations.
 * Provides methods to register, retrieve, and list protocol providers.
 *
 * @returns A ProtocolProviderStore with methods for managing protocol providers
 */
export function createProtocolProviderStore(): ProtocolProviderStore {
  const entries: ProtocolProviderEntry[] = []
  const addEntry = (name: string, provider: ProtocolProvider) =>
    entries.push(
      freeze({
        id: uuidV4(),
        name,
        provider,
      })
    )
  const getIndexById = (id: string) => entries.findIndex((e) => e.id === id)
  const getIndexByName = (name: string) => entries.findIndex((e) => e.name === name)
  const removeByIndex = (index: number) => entries.splice(index, 1)
  const getById = (id: string) => entries.find((e) => e.id === id)?.provider || null
  const getByName = (name: string) => entries.find((e) => e.name === name)?.provider || null
  const getByProvider = (provider: ProtocolProvider) => entries.find((e) => e.provider === provider)?.provider || null
  const nameExists = (name: string) => getIndexByName(name) > -1
  const idExists = (id: string) => getIndexById(id) > -1
  const providerExists = (provider: ProtocolProvider) => getByProvider(provider) !== null

  const add = (name: string, provider: ProtocolProvider) => {
    if (!isValidName(name)) {
      throw createError(`Cannot add a provider with invalid name`)
    }
    if (nameExists(name)) {
      throw createError(`Cannot add a provider with name '${name}' as it already exists`)
    }
    if (providerExists(provider)) {
      throw createError(`Cannot add a provider named '${name}'. It is already registered`)
    }
    addEntry(name, provider)
  }

  const removeByNameSingle = (name: string) => {
    const index = getIndexByName(name)
    if (index === -1) {
      throw createError(`No provider found with name '${name}' to remove`)
    }
    removeByIndex(index)
  }

  const removeByIdSingle = (id: string) => {
    const index = getIndexById(id)
    if (index === -1) {
      throw createError(`No provider found with id '${id}' to remove`)
    }
    removeByIndex(index)
  }

  const existsByName = (name: string): boolean => nameExists(name)

  const existsById = (id: string): boolean => idExists(id)

  const removeByName = (...names: string[]) => names.forEach(removeByNameSingle)

  const removeById = (...ids: string[]) => ids.forEach(removeByIdSingle)

  const clear = () => {
    do {
      entries.shift()
    } while (entries.length > 0)
  }

  return freeze({
    add,
    existsByName,
    existsById,
    removeByName,
    removeById,
    clear,
    getByName,
    getById,
    get list() {
      return freeze([...entries])
    },
  })
}
