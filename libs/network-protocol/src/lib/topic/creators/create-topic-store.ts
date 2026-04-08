import type { TopicStore, Topic } from '../model'
import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { uuidV4 } from '@hyperfrontend/random-generator-utils'
import { isValidName } from '../validations/is-valid-name'

/**
 * Creates a store for managing topic registrations and lookups.
 * Provides methods to create, retrieve, and list topics by name or ID.
 *
 * @returns A TopicStore with methods for managing topics
 *
 * @example
 * ```typescript
 * const store = createTopicStore()
 * store.create('notifications')
 * const topic = store.getByName('notifications')
 * // => { name: 'notifications', id: '550e8400-...' }
 * ```
 */
export function createTopicStore(): TopicStore {
  const topics = createSet<Topic>()
  const topicsByName = createMap<string, Topic>()
  const topicsById = createMap<string, Topic>()

  const createTopic = (name: string) => {
    if (topicsByName.has(name)) {
      throw createError(`Cannot create a topic with name '${name}' as a topic with that name already exists`)
    }
    if (!isValidName(name)) {
      throw createError(`Invalid topic name '${name}'`)
    }
    const id = uuidV4()
    const topic: Topic = freeze({ name, id })
    topics.add(topic)
    topicsByName.set(name, topic)
    topicsById.set(id, topic)
  }

  const handleCreate = (name: string) => createTopic(name)

  const addTopic = (topic: Topic) => {
    if (topicsByName.has(topic.name)) {
      throw createError(`Cannot add a topic with name '${topic.name}' as it already exists`)
    }
    topics.add(topic)
    topicsByName.set(topic.name, topic)
    topicsById.set(topic.id, topic)
  }

  const handleAdd = (topic: Topic) => addTopic(topic)

  const removeByNameSingle = (name: string) => {
    const topic = topicsByName.get(name)
    if (!topic) {
      throw createError(`No topic found with name '${name}' to remove`)
    }
    topics.delete(topic)
    topicsByName.delete(name)
    topicsById.delete(topic.id)
  }

  const removeByIdSingle = (id: string) => {
    const topic = topicsById.get(id)
    if (!topic) {
      throw createError(`No topic found with id '${id}' to remove`)
    }
    topics.delete(topic)
    topicsByName.delete(topic.name)
    topicsById.delete(id)
  }

  const create = (...names: string[]) => names.forEach(handleCreate)

  const add = (...topicsToAdd: Topic[]) => topicsToAdd.forEach(handleAdd)

  const existsByName = (name: string): boolean => topicsByName.has(name)

  const existsById = (id: string): boolean => topicsById.has(id)

  const removeByName = (...names: string[]) => names.forEach(removeByNameSingle)

  const removeById = (...ids: string[]) => ids.forEach(removeByIdSingle)

  const clear = () => {
    topics.clear()
    topicsByName.clear()
    topicsById.clear()
  }

  const getByName = (name: string) => topicsByName.get(name) || null

  const getById = (id: string) => topicsById.get(id) || null

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
      return freeze(from(topics))
    },
  })
}
