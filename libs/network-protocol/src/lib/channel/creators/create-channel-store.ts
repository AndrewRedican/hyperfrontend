import type { ChannelStore, Channel, ChannelEntry, ChannelCreater } from '../model'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { uuidV4 } from '@hyperfrontend/random-generator-utils'
import { isValidLabel } from '../validations/is-valid-label'

/**
 * Creates a channel store factory with an injected channel creator.
 *
 * @param createChannel - The channel creator function
 * @returns A function that creates channel stores
 *
 * @example Creating a channel store and adding a channel
 * ```typescript
 * const createStore = createChannelStoreFactory(channelCreator)
 * const store = createStore()
 * const channel = store.create('main', sendFn, receiveFn, protocol)
 * ```
 */
export function createChannelStoreFactory(createChannel: ChannelCreater) {
  return function createChannelStore(): ChannelStore {
    const entries: ChannelEntry[] = []
    const addEntry = (channel: Channel) =>
      entries.push(
        freeze({
          id: uuidV4(),
          name: channel.label,
          channel,
        })
      )
    const getIndexById = (id: string) => entries.findIndex((e) => e.id === id)
    const getIndexByName = (name: string) => entries.findIndex((e) => e.name === name)
    const removeByIndex = (index: number) => entries.splice(index, 1)
    const getById = (id: string) => entries.find((e) => e.id === id)?.channel || null
    const getByName = (name: string) => entries.find((e) => e.name === name)?.channel || null
    const getByChannel = (channel: Channel) => entries.find((e) => e.channel === channel)?.channel || null
    const existsByName = (name: string) => getIndexByName(name) > -1
    const existsById = (id: string) => getIndexById(id) > -1
    const channelExists = (channel: Channel) => getByChannel(channel) !== null

    const create: ChannelStore['create'] = (label, send, receive, protocol) => {
      if (!isValidLabel(label)) {
        throw createError(`Cannot add a channel with invalid name`)
      }
      if (existsByName(label)) {
        throw createError(`Cannot create a channel with name '${label}' as a channel with that name already exists`)
      }
      const channel = createChannel(label, send, receive, protocol)
      addEntry(channel)
      return channel
    }

    const addChannel = (channel: Channel) => {
      if (existsByName(channel.label)) {
        throw createError(`Cannot add a channel with name '${channel.label}' as it already exists`)
      }
      /* istanbul ignore next - defensive check: if instance exists, name will exist (checked above) */
      if (channelExists(channel)) {
        throw createError(`Cannot add a channel named '${channel.label}'. It is already registered`)
      }
      addEntry(channel)
    }

    const handleAdd = (channel: Channel) => addChannel(channel)

    const removeByNameSingle = (name: string) => {
      const index = getIndexByName(name)
      if (index === -1) {
        throw createError(`No channel found with name '${name}' to remove`)
      }
      removeByIndex(index)
    }

    const removeByIdSingle = (id: string) => {
      const index = getIndexById(id)
      if (index === -1) {
        throw createError(`No channel found with id '${id}' to remove`)
      }
      removeByIndex(index)
    }

    const add = (...channelsToAdd: Channel[]) => channelsToAdd.forEach(handleAdd)

    const removeByName = (...names: string[]) => names.forEach(removeByNameSingle)

    const removeById = (...ids: string[]) => ids.forEach(removeByIdSingle)

    const clear = () => {
      do {
        entries.shift()
      } while (entries.length > 0)
    }

    return freeze({
      create,
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
}
