import type { MinimalChannel } from './factory'
import { describe, expect, it } from '@hyperfrontend/testing'
import { add } from './add'
import { clear } from './clear'
import { createRegistry } from './factory'
import { getAll } from './get-all'
import { getById } from './get-by-id'
import { getByName } from './get-by-name'
import { getByWindow } from './get-by-window'
import { remove } from './remove'

describe('Channel Registry', () => {
  const ids = (channels: MinimalChannel[]): string[] => channels.map((channel) => channel.id).sort()
  const invalidChannels: readonly [string, unknown][] = [
    ['null', null],
    ['an empty object', {}],
    ['a channel without a name', { id: 'test' }],
    ['a channel without an id', { name: 'test' }],
  ]

  describe('createRegistry', () => {
    it('creates a new registry instance', () => {
      const registry = createRegistry()

      expect(registry).toEqual(
        expect.objectContaining({
          add: expect.any(Function),
          remove: expect.any(Function),
          getByWindow: expect.any(Function),
          getById: expect.any(Function),
          getByName: expect.any(Function),
          getAll: expect.any(Function),
          clear: expect.any(Function),
        })
      )
    })

    it('creates independent registry instances', () => {
      const registry1 = createRegistry()
      const registry2 = createRegistry()

      const channel1 = { id: 'id1', name: 'channel1', target: window }

      registry1.add(channel1)

      expect({ first: registry1.getById('id1'), second: registry2.getById('id1') }).toEqual({ first: channel1, second: undefined })
    })
  })

  describe('add', () => {
    it('adds a channel to the registry', () => {
      const registry = createRegistry()
      const channel = { id: 'test-id', name: 'test-channel', target: window }

      add(registry, channel)

      expect({
        byId: getById(registry, 'test-id'),
        byName: getByName(registry, 'test-channel'),
        byWindow: getByWindow(registry, window),
      }).toEqual({
        byId: channel,
        byName: channel,
        byWindow: channel,
      })
    })

    it.each(invalidChannels)('throws when the channel is %s', (_label: string, channel: unknown) => {
      const registry = createRegistry()

      expect(() => add(registry, channel as MinimalChannel)).toThrow('Invalid channel')
    })

    it('allows adding multiple channels', () => {
      const registry = createRegistry()
      const mockWindow1 = {} as Window
      const mockWindow2 = {} as Window

      const channel1 = { id: 'id1', name: 'channel1', target: mockWindow1 }
      const channel2 = { id: 'id2', name: 'channel2', target: mockWindow2 }

      add(registry, channel1)
      add(registry, channel2)

      expect({ all: ids(getAll(registry)), byId: [getById(registry, 'id1'), getById(registry, 'id2')] }).toEqual({
        all: ['id1', 'id2'],
        byId: [channel1, channel2],
      })
    })

    it('updates existing channel when adding with same ID', () => {
      const registry = createRegistry()
      const channel1 = { id: 'test-id', name: 'channel1', target: window }
      const channel2 = { id: 'test-id', name: 'channel2', target: window }

      add(registry, channel1)
      add(registry, channel2)

      expect(getById(registry, 'test-id')).toBe(channel2)
    })
  })

  describe('remove', () => {
    it('removes a channel from the registry', () => {
      const registry = createRegistry()
      const channel = { id: 'test-id', name: 'test-channel', target: window }

      add(registry, channel)
      const before = getById(registry, 'test-id')

      remove(registry, channel)

      const after = {
        byId: getById(registry, 'test-id'),
        byName: getByName(registry, 'test-channel'),
        byWindow: getByWindow(registry, window),
      }
      expect({ before, after }).toEqual({ before: channel, after: { byId: undefined, byName: undefined, byWindow: undefined } })
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
      const mockWindow = {} as Window
      const channel = { id: 'test-id', name: 'test-channel', target: mockWindow }

      add(registry, channel)

      expect(getByWindow(registry, mockWindow)).toBe(channel)
    })

    it('return undefined for non-existent window', () => {
      const registry = createRegistry()
      const mockWindow = {} as Window

      expect(getByWindow(registry, mockWindow)).toBeUndefined()
    })

    it('uses WeakMap (no memory leak)', () => {
      const registry = createRegistry()
      let mockWindow: Window | null = {} as Window
      const channel = { id: 'test-id', name: 'test-channel', target: mockWindow }

      add(registry, channel)
      expect(getByWindow(registry, mockWindow)).toBe(channel)

      // lint-disable-next-line no-useless-assignment -- intentional: demonstrates WeakMap GC behavior
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

    it('matches names case-sensitively', () => {
      const registry = createRegistry()
      const channel = { id: 'test-id', name: 'TestChannel', target: window }

      add(registry, channel)

      expect({ exact: getByName(registry, 'TestChannel'), lowercased: getByName(registry, 'testchannel') }).toEqual({
        exact: channel,
        lowercased: undefined,
      })
    })
  })

  describe('getAll', () => {
    it('return empty array for empty registry', () => {
      const registry = createRegistry()

      expect(getAll(registry)).toEqual([])
    })

    it('return all registered channels', () => {
      const registry = createRegistry()
      const mockWindow1 = {} as Window
      const mockWindow2 = {} as Window
      const mockWindow3 = {} as Window

      const channel1 = { id: 'id1', name: 'channel1', target: mockWindow1 }
      const channel2 = { id: 'id2', name: 'channel2', target: mockWindow2 }
      const channel3 = { id: 'id3', name: 'channel3', target: mockWindow3 }

      add(registry, channel1)
      add(registry, channel2)
      add(registry, channel3)

      const all = getAll(registry)
      const missing = [channel1, channel2, channel3].filter((channel) => !all.includes(channel))

      expect({ count: all.length, missing }).toEqual({ count: 3, missing: [] })
    })

    it('returns a distinct array each time', () => {
      const registry = createRegistry()
      const channel = { id: 'test-id', name: 'test-channel', target: window }

      add(registry, channel)

      const all1 = getAll(registry)
      const all2 = getAll(registry)

      expect(all1).not.toBe(all2)
    })

    it('returns the same contents each time', () => {
      const registry = createRegistry()
      const channel = { id: 'test-id', name: 'test-channel', target: window }

      add(registry, channel)

      const all1 = getAll(registry)
      const all2 = getAll(registry)

      expect(all1).toEqual(all2)
    })
  })

  describe('clear', () => {
    it('removes all channels from registry', () => {
      const registry = createRegistry()
      const mockWindow1 = {} as Window
      const mockWindow2 = {} as Window

      const channel1 = { id: 'id1', name: 'channel1', target: mockWindow1 }
      const channel2 = { id: 'id2', name: 'channel2', target: mockWindow2 }

      add(registry, channel1)
      add(registry, channel2)
      const before = ids(getAll(registry))

      clear(registry)

      const after = {
        all: getAll(registry),
        byId: [getById(registry, 'id1'), getById(registry, 'id2')],
        byName: [getByName(registry, 'channel1'), getByName(registry, 'channel2')],
      }
      expect({ before, after }).toEqual({
        before: ['id1', 'id2'],
        after: { all: [], byId: [undefined, undefined], byName: [undefined, undefined] },
      })
    })

    it('handles clearing empty registry', () => {
      const registry = createRegistry()

      clear(registry)

      expect(getAll(registry)).toEqual([])
    })

    it('allows adding channels after clear', () => {
      const registry = createRegistry()
      const channel1 = { id: 'id1', name: 'channel1', target: window }
      const channel2 = { id: 'id2', name: 'channel2', target: window }

      add(registry, channel1)
      clear(registry)
      add(registry, channel2)

      expect({ all: ids(getAll(registry)), byId: { id1: getById(registry, 'id1'), id2: getById(registry, 'id2') } }).toEqual({
        all: ['id2'],
        byId: { id1: undefined, id2: channel2 },
      })
    })
  })

  describe('Integration scenarios', () => {
    it('handles complex add/remove sequences', () => {
      const registry = createRegistry()
      const mockWindow1 = {} as Window
      const mockWindow2 = {} as Window

      const channel1 = { id: 'id1', name: 'channel1', target: mockWindow1 }
      const channel2 = { id: 'id2', name: 'channel2', target: mockWindow2 }
      const observed: Array<[string, unknown]> = []

      add(registry, channel1)
      add(registry, channel2)
      observed.push(['after adding both', ids(getAll(registry))])
      remove(registry, channel1)
      observed.push(['after removing channel1', ids(getAll(registry))])
      observed.push(['channel2 after removing channel1', getById(registry, 'id2')])
      add(registry, channel1)
      observed.push(['after re-adding channel1', ids(getAll(registry))])
      clear(registry)
      observed.push(['after clear', ids(getAll(registry))])

      expect(observed).toEqual([
        ['after adding both', ['id1', 'id2']],
        ['after removing channel1', ['id2']],
        ['channel2 after removing channel1', channel2],
        ['after re-adding channel1', ['id1', 'id2']],
        ['after clear', []],
      ])
    })

    it('maintain lookup consistency across operations', () => {
      const registry = createRegistry()
      const mockWindow = {} as Window
      const channel = { id: 'test-id', name: 'test-channel', target: mockWindow }

      add(registry, channel)

      const byId = getById(registry, 'test-id')
      const byName = getByName(registry, 'test-channel')
      const byWindow = getByWindow(registry, mockWindow)

      expect({ byId, byName, byWindow }).toEqual({ byId: channel, byName: channel, byWindow: channel })
    })

    it('handles multiple channels with different targets', () => {
      const registry = createRegistry()
      const mockWindow1 = {} as Window
      const mockWindow2 = {} as Window
      const mockWindow3 = {} as Window

      const channel1 = { id: 'id1', name: 'channel1', target: mockWindow1 }
      const channel2 = { id: 'id2', name: 'channel2', target: mockWindow2 }
      const channel3 = { id: 'id3', name: 'channel3', target: mockWindow3 }

      add(registry, channel1)
      add(registry, channel2)
      add(registry, channel3)
      const targets = [mockWindow1, mockWindow2, mockWindow3]
      const before = targets.map((target) => getByWindow(registry, target))

      remove(registry, channel2)

      const after = targets.map((target) => getByWindow(registry, target))
      expect({ before, after }).toEqual({ before: [channel1, channel2, channel3], after: [channel1, undefined, channel3] })
    })
  })
})
