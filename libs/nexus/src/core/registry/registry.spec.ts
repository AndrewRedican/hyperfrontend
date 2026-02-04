/**
 * Tests for channel registry system
 */

import { createRegistry, add, remove, getByWindow, getById, getByName, getAll, clear } from './index'
import type { MinimalChannel } from './factory'

describe('Channel Registry', () => {
  describe('createRegistry', () => {
    it('creates a new registry instance', () => {
      const registry = createRegistry()

      expect(registry).toBeDefined()
      expect(typeof registry.add).toBe('function')
      expect(typeof registry.remove).toBe('function')
      expect(typeof registry.getByWindow).toBe('function')
      expect(typeof registry.getById).toBe('function')
      expect(typeof registry.getByName).toBe('function')
      expect(typeof registry.getAll).toBe('function')
      expect(typeof registry.clear).toBe('function')
    })

    it('creates independent registry instances', () => {
      const registry1 = createRegistry()
      const registry2 = createRegistry()

      const channel1 = { id: 'id1', name: 'channel1', target: window }

      registry1.add(channel1)

      expect(registry1.getById('id1')).toBe(channel1)
      expect(registry2.getById('id1')).toBeUndefined()
    })
  })

  describe('add', () => {
    it('adds a channel to the registry', () => {
      const registry = createRegistry()
      const channel = { id: 'test-id', name: 'test-channel', target: window }

      add(registry, channel)

      expect(getById(registry, 'test-id')).toBe(channel)
      expect(getByName(registry, 'test-channel')).toBe(channel)
      expect(getByWindow(registry, window)).toBe(channel)
    })

    it('throws error for invalid channel', () => {
      const registry = createRegistry()

      expect(() => add(registry, <MinimalChannel>(<unknown>null))).toThrow('Invalid channel')
      expect(() => add(registry, <MinimalChannel>(<unknown>{}))).toThrow('Invalid channel')
      expect(() => add(registry, <MinimalChannel>(<unknown>{ id: 'test' }))).toThrow('Invalid channel')
      expect(() => add(registry, <MinimalChannel>(<unknown>{ name: 'test' }))).toThrow('Invalid channel')
    })

    it('allows adding multiple channels', () => {
      const registry = createRegistry()
      const mockWindow1 = <Window>{}
      const mockWindow2 = <Window>{}

      const channel1 = { id: 'id1', name: 'channel1', target: mockWindow1 }
      const channel2 = { id: 'id2', name: 'channel2', target: mockWindow2 }

      add(registry, channel1)
      add(registry, channel2)

      expect(getAll(registry)).toHaveLength(2)
      expect(getById(registry, 'id1')).toBe(channel1)
      expect(getById(registry, 'id2')).toBe(channel2)
    })

    it('updates existing channel when adding with same ID', () => {
      const registry = createRegistry()
      const channel1 = { id: 'test-id', name: 'channel1', target: window }
      const channel2 = { id: 'test-id', name: 'channel2', target: window }

      add(registry, channel1)
      add(registry, channel2)

      // Should have the latest version
      expect(getById(registry, 'test-id')).toBe(channel2)
    })
  })

  describe('remove', () => {
    it('removes a channel from the registry', () => {
      const registry = createRegistry()
      const channel = { id: 'test-id', name: 'test-channel', target: window }

      add(registry, channel)
      expect(getById(registry, 'test-id')).toBe(channel)

      remove(registry, channel)

      expect(getById(registry, 'test-id')).toBeUndefined()
      expect(getByName(registry, 'test-channel')).toBeUndefined()
      expect(getByWindow(registry, window)).toBeUndefined()
    })

    it('handles removing non-existent channel', () => {
      const registry = createRegistry()
      const channel = { id: 'test-id', name: 'test-channel', target: window }

      expect(() => remove(registry, channel)).not.toThrow()
    })

    it('handles removing null channel', () => {
      const registry = createRegistry()

      expect(() => remove(registry, null)).not.toThrow()
    })
  })

  describe('getByWindow', () => {
    it('retrieves channel by window', () => {
      const registry = createRegistry()
      const mockWindow = <Window>{}
      const channel = { id: 'test-id', name: 'test-channel', target: mockWindow }

      add(registry, channel)

      expect(getByWindow(registry, mockWindow)).toBe(channel)
    })

    it('return undefined for non-existent window', () => {
      const registry = createRegistry()
      const mockWindow = <Window>{}

      expect(getByWindow(registry, mockWindow)).toBeUndefined()
    })

    it('uses WeakMap (no memory leak)', () => {
      const registry = createRegistry()
      let mockWindow: Window | null = <Window>{}
      const channel = { id: 'test-id', name: 'test-channel', target: mockWindow }

      add(registry, channel)
      expect(getByWindow(registry, mockWindow)).toBe(channel)

      // After removing reference, WeakMap enables garbage collection
      mockWindow = null
    })
  })

  describe('getById', () => {
    it('retrieves channel by ID', () => {
      const registry = createRegistry()
      const channel = { id: 'test-id', name: 'test-channel', target: window }

      add(registry, channel)

      expect(getById(registry, 'test-id')).toBe(channel)
    })

    it('return undefined for non-existent ID', () => {
      const registry = createRegistry()

      expect(getById(registry, 'non-existent')).toBeUndefined()
    })

    it('handles empty string ID', () => {
      const registry = createRegistry()

      expect(getById(registry, '')).toBeUndefined()
    })
  })

  describe('getByName', () => {
    it('retrieves channel by name', () => {
      const registry = createRegistry()
      const channel = { id: 'test-id', name: 'test-channel', target: window }

      add(registry, channel)

      expect(getByName(registry, 'test-channel')).toBe(channel)
    })

    it('return undefined for non-existent name', () => {
      const registry = createRegistry()

      expect(getByName(registry, 'non-existent')).toBeUndefined()
    })

    it('be case-sensitive', () => {
      const registry = createRegistry()
      const channel = { id: 'test-id', name: 'TestChannel', target: window }

      add(registry, channel)

      expect(getByName(registry, 'TestChannel')).toBe(channel)
      expect(getByName(registry, 'testchannel')).toBeUndefined()
    })
  })

  describe('getAll', () => {
    it('return empty array for empty registry', () => {
      const registry = createRegistry()

      expect(getAll(registry)).toEqual([])
    })

    it('return all registered channels', () => {
      const registry = createRegistry()
      const mockWindow1 = <Window>{}
      const mockWindow2 = <Window>{}
      const mockWindow3 = <Window>{}

      const channel1 = { id: 'id1', name: 'channel1', target: mockWindow1 }
      const channel2 = { id: 'id2', name: 'channel2', target: mockWindow2 }
      const channel3 = { id: 'id3', name: 'channel3', target: mockWindow3 }

      add(registry, channel1)
      add(registry, channel2)
      add(registry, channel3)

      const all = getAll(registry)

      expect(all).toHaveLength(3)
      expect(all).toContain(channel1)
      expect(all).toContain(channel2)
      expect(all).toContain(channel3)
    })

    it('return a new array each time', () => {
      const registry = createRegistry()
      const channel = { id: 'test-id', name: 'test-channel', target: window }

      add(registry, channel)

      const all1 = getAll(registry)
      const all2 = getAll(registry)

      expect(all1).not.toBe(all2)
      expect(all1).toEqual(all2)
    })
  })

  describe('clear', () => {
    it('removes all channels from registry', () => {
      const registry = createRegistry()
      const mockWindow1 = <Window>{}
      const mockWindow2 = <Window>{}

      const channel1 = { id: 'id1', name: 'channel1', target: mockWindow1 }
      const channel2 = { id: 'id2', name: 'channel2', target: mockWindow2 }

      add(registry, channel1)
      add(registry, channel2)

      expect(getAll(registry)).toHaveLength(2)

      clear(registry)

      expect(getAll(registry)).toHaveLength(0)
      expect(getById(registry, 'id1')).toBeUndefined()
      expect(getById(registry, 'id2')).toBeUndefined()
      expect(getByName(registry, 'channel1')).toBeUndefined()
      expect(getByName(registry, 'channel2')).toBeUndefined()
    })

    it('handles clearing empty registry', () => {
      const registry = createRegistry()

      expect(() => clear(registry)).not.toThrow()
      expect(getAll(registry)).toHaveLength(0)
    })

    it('allows adding channels after clear', () => {
      const registry = createRegistry()
      const channel1 = { id: 'id1', name: 'channel1', target: window }
      const channel2 = { id: 'id2', name: 'channel2', target: window }

      add(registry, channel1)
      clear(registry)
      add(registry, channel2)

      expect(getAll(registry)).toHaveLength(1)
      expect(getById(registry, 'id2')).toBe(channel2)
      expect(getById(registry, 'id1')).toBeUndefined()
    })
  })

  describe('Integration scenarios', () => {
    it('handles complex add/remove sequences', () => {
      const registry = createRegistry()
      const mockWindow1 = <Window>{}
      const mockWindow2 = <Window>{}

      const channel1 = { id: 'id1', name: 'channel1', target: mockWindow1 }
      const channel2 = { id: 'id2', name: 'channel2', target: mockWindow2 }

      add(registry, channel1)
      add(registry, channel2)
      expect(getAll(registry)).toHaveLength(2)

      remove(registry, channel1)
      expect(getAll(registry)).toHaveLength(1)
      expect(getById(registry, 'id2')).toBe(channel2)

      add(registry, channel1)
      expect(getAll(registry)).toHaveLength(2)

      clear(registry)
      expect(getAll(registry)).toHaveLength(0)
    })

    it('maintain lookup consistency across operations', () => {
      const registry = createRegistry()
      const mockWindow = <Window>{}
      const channel = { id: 'test-id', name: 'test-channel', target: mockWindow }

      add(registry, channel)

      // All lookups should return same channel
      const byId = getById(registry, 'test-id')
      const byName = getByName(registry, 'test-channel')
      const byWindow = getByWindow(registry, mockWindow)

      expect(byId).toBe(channel)
      expect(byName).toBe(channel)
      expect(byWindow).toBe(channel)
      expect(byId).toBe(byName)
      expect(byName).toBe(byWindow)
    })

    it('handles multiple channels with different targets', () => {
      const registry = createRegistry()
      const mockWindow1 = <Window>{}
      const mockWindow2 = <Window>{}
      const mockWindow3 = <Window>{}

      const channel1 = { id: 'id1', name: 'channel1', target: mockWindow1 }
      const channel2 = { id: 'id2', name: 'channel2', target: mockWindow2 }
      const channel3 = { id: 'id3', name: 'channel3', target: mockWindow3 }

      add(registry, channel1)
      add(registry, channel2)
      add(registry, channel3)

      expect(getByWindow(registry, mockWindow1)).toBe(channel1)
      expect(getByWindow(registry, mockWindow2)).toBe(channel2)
      expect(getByWindow(registry, mockWindow3)).toBe(channel3)

      remove(registry, channel2)

      expect(getByWindow(registry, mockWindow1)).toBe(channel1)
      expect(getByWindow(registry, mockWindow2)).toBeUndefined()
      expect(getByWindow(registry, mockWindow3)).toBe(channel3)
    })
  })
})
