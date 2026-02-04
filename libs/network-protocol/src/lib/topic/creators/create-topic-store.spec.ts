import type { Topic, TopicStore } from '../model'
import { isValidTopic } from '../validations'
import { createTopicStore } from './create-topic-store'

describe('TopicStore', () => {
  let store: TopicStore

  beforeEach(() => (store = createTopicStore()))

  describe('create', () => {
    it('successfully creates a topic', () => {
      store.create('New Topic')
      const topic = <Topic>store.getByName('New Topic')
      expect(isValidTopic(topic)).toBe(true)
      expect(topic.name).toEqual('New Topic')
    })

    it('throws an error when creating a topic with an existing name', () => {
      store.create('New Topic')
      expect(() => store.create('New Topic')).toThrow(
        "Cannot create a topic with name 'New Topic' as a topic with that name already exists"
      )
    })

    it('throws an error for invalid topic name', () => {
      expect(() => store.create('')).toThrow("Invalid topic name ''")
    })
  })

  describe('add', () => {
    it('successfully adds a topic', () => {
      const topic = { name: 'Imported Topic', id: 'unique-id' }
      store.add(topic)
      expect(store.existsById('unique-id')).toBeTruthy()
    })

    it('throws an error when adding a topic with an existing name', () => {
      const topic1 = { name: 'Unique Topic', id: 'unique-id1' }
      store.add(topic1)
      const topic2 = { name: 'Unique Topic', id: 'unique-id2' }
      expect(() => store.add(topic2)).toThrow("Cannot add a topic with name 'Unique Topic' as it already exists")
    })
  })

  describe('existsByName', () => {
    it('returns true for an existing topic by name', () => {
      store.create('Existing Topic')
      expect(store.existsByName('Existing Topic')).toBe(true)
    })

    it('returns false for a non-existing topic by name', () => {
      expect(store.existsByName('Nonexistent Topic')).toBe(false)
    })
  })

  describe('existsById', () => {
    it('returns true for an existing topic by id', () => {
      const topic = { name: 'Topic With ID', id: 'id-to-check' }
      store.add(topic)
      expect(store.existsById('id-to-check')).toBe(true)
    })

    it('returns false for a non-existing topic by id', () => {
      expect(store.existsById('nonexistent-id')).toBe(false)
    })
  })

  describe('removeByName', () => {
    beforeEach(() => {
      store.create('Removable Topic')
    })

    it('removes a topic by name', () => {
      store.removeByName('Removable Topic')
      expect(store.existsByName('Removable Topic')).toBe(false)
    })

    it('throws an error when removing a non-existing topic by name', () => {
      expect(() => store.removeByName('Nonexistent Topic')).toThrow("No topic found with name 'Nonexistent Topic' to remove")
    })
  })

  describe('removeById', () => {
    beforeEach(() => {
      store.add({ name: 'Another Removable Topic', id: 'removable-id' })
    })

    it('removes a topic by id', () => {
      store.removeById('removable-id')
      expect(store.existsById('removable-id')).toBe(false)
    })

    it('throws an error when removing a non-existing topic by id', () => {
      expect(() => store.removeById('nonexistent-id')).toThrow("No topic found with id 'nonexistent-id' to remove")
    })
  })

  describe('clear', () => {
    it('clears all topics', () => {
      store.create('Topic 1')
      store.add({ name: 'Topic 2', id: 'id2' })
      expect(store.list.length).toBeGreaterThan(0)
      store.clear()
      expect(store.list.length).toBe(0)
    })
  })

  describe('getByName', () => {
    it('retrieves a topic by name', () => {
      store.create('Topic By Name')
      const topic = <Topic>store.getByName('Topic By Name')
      expect(isValidTopic(topic)).toBe(true)
      expect(topic.name).toEqual('Topic By Name')
    })

    it('returns null for a nonexistent topic by name', () => {
      expect(store.getByName('Nonexistent Topic')).toBeNull()
    })
  })

  describe('getById', () => {
    it('retrieves a topic by id', () => {
      store.create('Topic By ID')
      const topicByName = <Topic>store.getByName('Topic By ID')
      const topic = <Topic>store.getById(topicByName.id)
      expect(isValidTopic(topic)).toBe(true)
      expect(topic.id).toBe(topicByName.id)
    })

    it('returns null for a nonexistent topic by id', () => {
      expect(store.getById('nonexistent-id')).toBeNull()
    })
  })

  describe('list', () => {
    it('lists all topics', () => {
      store.create('Topic 1')
      store.add({ name: 'Topic 2', id: 'id2' })
      const topicsList = store.list
      expect(topicsList.length).toBe(2)
      expect(topicsList.some((t) => t.name === 'Topic 1')).toBe(true)
      expect(topicsList.some((t) => t.id === 'id2')).toBe(true)
    })
  })

  describe('existsByName 2', () => {
    it('verifies that a topic exists by name', () => {
      store.create('Existing Topic')
      expect(store.existsByName('Existing Topic')).toBe(true)
      expect(store.existsByName('Nonexistent Topic')).toBe(false)
    })
  })

  describe('existsById 2', () => {
    it('verifies that a topic exists by id', () => {
      const topic = { name: 'Unique Topic', id: 'unique-id' }
      store.add(topic)
      expect(store.existsById('unique-id')).toBe(true)
      expect(store.existsById('nonexistent-id')).toBe(false)
    })
  })

  describe('removeByName 2', () => {
    it('successfully removes a topic by name', () => {
      store.create('Removable Topic')
      store.removeByName('Removable Topic')
      expect(store.existsByName('Removable Topic')).toBe(false)
    })

    it('throws error when removing a topic by a nonexistent name', () => {
      expect(() => store.removeByName('Nonexistent Topic')).toThrow(new Error("No topic found with name 'Nonexistent Topic' to remove"))
    })
  })

  describe('removeById 2', () => {
    it('successfully removes a topic by id', () => {
      store.create('Another Removable Topic')
      const topic = <Topic>store.getByName('Another Removable Topic')
      store.removeById(topic.id)
      expect(store.existsById(topic.id)).toBe(false)
    })

    it('throws error when removing a topic by a nonexistent id', () => {
      expect(() => store.removeById('nonexistent-id')).toThrow(new Error("No topic found with id 'nonexistent-id' to remove"))
    })
  })

  describe('clear 2', () => {
    it('clears all topics', () => {
      store.create('Topic 1')
      store.add({ name: 'Topic 2', id: 'id2' })
      store.clear()
      expect(store.list.length).toBe(0)
    })
  })
})
