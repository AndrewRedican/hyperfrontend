/**
 * Tests for protocol provider store
 */

import type { ProtocolProvider } from '../../channel/model'
import { createProtocolProviderStore } from './create-provider-protocol-store'

describe('createProtocolProviderStore', () => {
  const mockProvider1: ProtocolProvider = {
    name: 'test-provider-1',
    send: jest.fn(),
    receive: jest.fn(),
  }

  const mockProvider2: ProtocolProvider = {
    name: 'test-provider-2',
    send: jest.fn(),
    receive: jest.fn(),
  }

  const mockProvider3: ProtocolProvider = {
    name: 'test-provider-3',
    send: jest.fn(),
    receive: jest.fn(),
  }

  describe('add', () => {
    it('adds a provider with valid name', () => {
      const store = createProtocolProviderStore()

      expect(() => store.add('provider1', mockProvider1)).not.toThrow()
      expect(store.existsByName('provider1')).toBe(true)
    })

    it('throws error when adding provider with invalid name', () => {
      const store = createProtocolProviderStore()

      expect(() => store.add('', mockProvider1)).toThrow('Cannot add a provider with invalid name')
    })

    it('throws error when adding provider with duplicate name', () => {
      const store = createProtocolProviderStore()
      store.add('provider1', mockProvider1)

      expect(() => store.add('provider1', mockProvider2)).toThrow("Cannot add a provider with name 'provider1' as it already exists")
    })

    it('throws error when adding same provider instance again', () => {
      const store = createProtocolProviderStore()
      store.add('provider1', mockProvider1)

      expect(() => store.add('provider2', mockProvider1)).toThrow("Cannot add a provider named 'provider2'. It is already registered")
    })

    it('adds multiple providers with different names', () => {
      const store = createProtocolProviderStore()

      store.add('provider1', mockProvider1)
      store.add('provider2', mockProvider2)
      store.add('provider3', mockProvider3)

      expect(store.list.length).toBe(3)
    })
  })

  describe('existsByName', () => {
    it('returns true for existing provider name', () => {
      const store = createProtocolProviderStore()
      store.add('provider1', mockProvider1)

      expect(store.existsByName('provider1')).toBe(true)
    })

    it('returns false for non-existing provider name', () => {
      const store = createProtocolProviderStore()

      expect(store.existsByName('nonexistent')).toBe(false)
    })
  })

  describe('existsById', () => {
    it('returns true for existing provider id', () => {
      const store = createProtocolProviderStore()
      store.add('provider1', mockProvider1)
      const id = store.list[0].id

      expect(store.existsById(id)).toBe(true)
    })

    it('returns false for non-existing provider id', () => {
      const store = createProtocolProviderStore()

      expect(store.existsById('nonexistent-id')).toBe(false)
    })
  })

  describe('getByName', () => {
    it('returns provider for existing name', () => {
      const store = createProtocolProviderStore()
      store.add('provider1', mockProvider1)

      const result = store.getByName('provider1')

      expect(result).toBe(mockProvider1)
    })

    it('returns null for non-existing name', () => {
      const store = createProtocolProviderStore()

      const result = store.getByName('nonexistent')

      expect(result).toBe(null)
    })
  })

  describe('getById', () => {
    it('returns provider for existing id', () => {
      const store = createProtocolProviderStore()
      store.add('provider1', mockProvider1)
      const id = store.list[0].id

      const result = store.getById(id)

      expect(result).toBe(mockProvider1)
    })

    it('returns null for non-existing id', () => {
      const store = createProtocolProviderStore()

      const result = store.getById('nonexistent-id')

      expect(result).toBe(null)
    })
  })

  describe('removeByName', () => {
    it('removes single provider by name', () => {
      const store = createProtocolProviderStore()
      store.add('provider1', mockProvider1)

      store.removeByName('provider1')

      expect(store.existsByName('provider1')).toBe(false)
    })

    it('removes multiple providers by name', () => {
      const store = createProtocolProviderStore()
      store.add('provider1', mockProvider1)
      store.add('provider2', mockProvider2)
      store.add('provider3', mockProvider3)

      store.removeByName('provider1', 'provider3')

      expect(store.existsByName('provider1')).toBe(false)
      expect(store.existsByName('provider2')).toBe(true)
      expect(store.existsByName('provider3')).toBe(false)
    })

    it('throws error when removing non-existing provider by name', () => {
      const store = createProtocolProviderStore()

      expect(() => store.removeByName('nonexistent')).toThrow("No provider found with name 'nonexistent' to remove")
    })
  })

  describe('removeById', () => {
    it('removes single provider by id', () => {
      const store = createProtocolProviderStore()
      store.add('provider1', mockProvider1)
      const id = store.list[0].id

      store.removeById(id)

      expect(store.existsById(id)).toBe(false)
    })

    it('removes multiple providers by id', () => {
      const store = createProtocolProviderStore()
      store.add('provider1', mockProvider1)
      store.add('provider2', mockProvider2)
      store.add('provider3', mockProvider3)
      const id1 = store.list[0].id
      const id2 = store.list[1].id
      const id3 = store.list[2].id

      store.removeById(id1, id3)

      expect(store.existsById(id1)).toBe(false)
      expect(store.existsById(id2)).toBe(true)
      expect(store.existsById(id3)).toBe(false)
    })

    it('throws error when removing non-existing provider by id', () => {
      const store = createProtocolProviderStore()

      expect(() => store.removeById('nonexistent-id')).toThrow("No provider found with id 'nonexistent-id' to remove")
    })
  })

  describe('clear', () => {
    it('removes all providers from store', () => {
      const store = createProtocolProviderStore()
      store.add('provider1', mockProvider1)
      store.add('provider2', mockProvider2)
      store.add('provider3', mockProvider3)

      store.clear()

      expect(store.list.length).toBe(0)
    })

    it('works on empty store', () => {
      const store = createProtocolProviderStore()

      expect(() => store.clear()).not.toThrow()
      expect(store.list.length).toBe(0)
    })
  })

  describe('list', () => {
    it('returns frozen array of entries', () => {
      const store = createProtocolProviderStore()
      store.add('provider1', mockProvider1)

      const list = store.list

      expect(Object.isFrozen(list)).toBe(true)
    })

    it('returns copy of entries (not reference)', () => {
      const store = createProtocolProviderStore()
      store.add('provider1', mockProvider1)

      const list1 = store.list
      const list2 = store.list

      expect(list1).not.toBe(list2)
      expect(list1).toEqual(list2)
    })

    it('returns entries with id, name, and provider', () => {
      const store = createProtocolProviderStore()
      store.add('provider1', mockProvider1)

      const entry = store.list[0]

      expect(entry).toHaveProperty('id')
      expect(entry).toHaveProperty('name')
      expect(entry).toHaveProperty('provider')
      expect(entry.name).toBe('provider1')
      expect(entry.provider).toBe(mockProvider1)
      expect(typeof entry.id).toBe('string')
    })

    it('entries are frozen', () => {
      const store = createProtocolProviderStore()
      store.add('provider1', mockProvider1)

      const entry = store.list[0]

      expect(Object.isFrozen(entry)).toBe(true)
    })
  })

  describe('store object', () => {
    it('returns frozen store object', () => {
      const store = createProtocolProviderStore()

      expect(Object.isFrozen(store)).toBe(true)
    })
  })
})
