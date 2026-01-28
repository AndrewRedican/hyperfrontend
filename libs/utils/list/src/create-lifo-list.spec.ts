import type { LifoList } from './create-lifo-list'
import { createLifoList } from './create-lifo-list'

describe('createLifoList', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lifoList: LifoList<any>

  beforeEach(() => {
    lifoList = createLifoList()
  })

  describe('push()', () => {
    it('adds items correctly', () => {
      const item = {}
      lifoList.push(item)
      expect(lifoList.size()).toBe(1)
    })

    it('throws an error for primitives', () => {
      expect(() => lifoList.push(5)).toThrow()
    })
  })

  describe('pull()', () => {
    it('removes and returns the last item', () => {
      const item1 = {}
      const item2 = {}
      lifoList.push(item1)
      lifoList.push(item2)
      expect(lifoList.pull()).toBe(item2)
      expect(lifoList.size()).toBe(1)
      expect(lifoList.pull()).toBe(item1)
      expect(lifoList.size()).toBe(0)
    })

    it('returns undefined if list is empty', () => {
      expect(lifoList.pull()).toBeUndefined()
    })
  })

  describe('map()', () => {
    it('applies a function to each element', () => {
      lifoList.push({ value: 1 })
      lifoList.push({ value: 2 })
      const result = lifoList.map((item) => item.value * 2)
      expect(result).toEqual([2, 4])
    })
  })

  describe('forEach()', () => {
    it('executes a function for each item', () => {
      lifoList.push({ value: 1 })
      lifoList.push({ value: 2 })
      const mockCallback = jest.fn()
      lifoList.forEach(mockCallback)
      expect(mockCallback.mock.calls.length).toBe(2)
    })
  })

  describe('remove()', () => {
    it('deletes an item and returns true', () => {
      const item = {}
      lifoList.push(item)
      expect(lifoList.remove(item)).toBe(true)
      expect(lifoList.has(item)).toBe(false)
    })

    it('returns false if item does not exist', () => {
      expect(lifoList.remove({})).toBe(false)
    })
  })

  describe('has()', () => {
    it('checks if an item exists in the list', () => {
      const item = {}
      lifoList.push(item)
      expect(lifoList.has(item)).toBe(true)
      expect(lifoList.has({})).toBe(false)
    })
  })

  describe('size()', () => {
    it('returns the number of items', () => {
      lifoList.push({})
      lifoList.push({})
      expect(lifoList.size()).toBe(2)
    })
  })

  describe('clear()', () => {
    it('removes all items from the list', () => {
      lifoList.push({})
      lifoList.push({})
      lifoList.clear()
      expect(lifoList.size()).toBe(0)
    })
  })
})
