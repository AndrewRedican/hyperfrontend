import type { ChannelStore } from '../model'
import { isUuidV4 } from '@hyperfrontend/random-generator-utils'
import { mockCreateChannelStore as createChannelStore } from './mocks'
import { protocolProvider, send, receive } from '../mocks'
import { label } from './mocks'

describe('createChannelStore', () => {
  let store: ChannelStore

  beforeEach(() => (store = createChannelStore()))

  describe('create', () => {
    it('creates and adds a valid channel', () => {
      expect(() => store.create(label, send, receive, protocolProvider)).not.toThrow()
      expect(store.list.length).toBe(1)
      expect(store.list[0].name).toBe(label)
      expect(isUuidV4(store.list[0].id)).toBe(true)
    })

    it('throws an error for invalid label', () => {
      expect(() => store.create('', send, receive, protocolProvider)).toThrow('Cannot add a channel with invalid name')
    })

    it('throws an error for duplicate name', () => {
      store.create(label, send, receive, protocolProvider)
      expect(() => store.create(label, send, receive, protocolProvider)).toThrow(
        `Cannot create a channel with name '${label}' as a channel with that name already exists`
      )
    })
  })

  describe('existsByName', () => {
    it('checks if a channel with the name exists', () => {
      store.create(label, send, receive, protocolProvider)
      expect(store.existsByName(label)).toBe(true)
      expect(store.existsByName('NonExistingChannel')).toBe(false)
    })
  })

  describe('existsById', () => {
    it('checks if a channel with the ID exists', () => {
      store.create(label, send, receive, protocolProvider)
      expect(store.existsById(store.list[0].id)).toBe(true)
      expect(store.existsById('non-existing-id')).toBe(false)
    })
  })

  describe('removeByName', () => {
    beforeEach(() => store.create(label, send, receive, protocolProvider))

    it('removes a channel by name', () => {
      expect(store.list.length).toBe(1)
      store.removeByName(label)
      expect(store.list.length).toBe(0)
    })

    it('throws an error if no channel with the name exists to remove', () => {
      expect(() => store.removeByName('NonExistingChannel')).toThrow(`No channel found with name 'NonExistingChannel' to remove`)
    })
  })

  describe('removeById', () => {
    beforeEach(() => store.create(label, send, receive, protocolProvider))

    it('removes a channel by id', () => {
      expect(store.list.length).toBe(1)
      store.removeById(store.list[0].id)
      expect(store.list.length).toBe(0)
    })

    it('throws an error if no channel with the id exists to remove', () => {
      expect(() => store.removeById('non-existing-id')).toThrow(`No channel found with id 'non-existing-id' to remove`)
    })
  })

  describe('getByName', () => {
    beforeEach(() => store.create(label, send, receive, protocolProvider))

    it('retrieves a channel by name', () => {
      const retrievedChannel = store.getByName(label)
      expect(retrievedChannel).not.toBeNull()
    })

    it('returns null if no channel with the name exists', () => {
      const retrievedChannel = store.getByName('NonExistingChannel')
      expect(retrievedChannel).toBeNull()
    })
  })

  describe('getById', () => {
    beforeEach(() => store.create(label, send, receive, protocolProvider))

    it('retrieves a channel by id', () => {
      const retrievedChannel = store.getById(store.list[0].id)
      expect(retrievedChannel).not.toBeNull()
    })

    it('returns null if no channel with the id exists', () => {
      const retrievedChannel = store.getById('non-existing-id')
      expect(retrievedChannel).toBeNull()
    })
  })

  describe('clear', () => {
    it('removes all channels', () => {
      store.create(label, send, receive, protocolProvider)
      expect(store.list.length).toBeGreaterThan(0)
      store.clear()
      expect(store.list.length).toBe(0)
    })
  })

  describe('add', () => {
    it('adds an existing channel to the store', () => {
      const channel = store.create(label, send, receive, protocolProvider)
      store.removeByName(label)

      expect(() => store.add(channel)).not.toThrow()
      expect(store.list.length).toBe(1)
    })

    it('throws error when adding channel with duplicate name', () => {
      const channel = store.create(label, send, receive, protocolProvider)

      expect(() => store.add(channel)).toThrow(`Cannot add a channel with name '${label}' as it already exists`)
    })

    it('throws error when adding same channel instance again', () => {
      const channel1 = store.create(label, send, receive, protocolProvider)
      store.create('label2', send, receive, protocolProvider)
      store.removeByName('label2')

      expect(() => store.add(channel1)).toThrow(`Cannot add a channel with name '${label}' as it already exists`)
    })
  })
})
