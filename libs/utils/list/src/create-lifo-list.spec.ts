import type { LifoList } from './create-lifo-list'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createLifoList } from './create-lifo-list'

describe('createLifoList', () => {
  // lint-disable-next-line typescript/no-explicit-any
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

    it('throws an error for null', () => {
      expect(() => lifoList.push(null)).toThrow()
    })

    it('accepts an array', () => {
      lifoList.push([1, 2])
      expect(lifoList.size()).toBe(1)
    })

    it('accepts a function', () => {
      lifoList.push(() => undefined)
      expect(lifoList.size()).toBe(1)
    })

    it('accepts a class instance', () => {
      class Task {}
      lifoList.push(new Task())
      expect(lifoList.size()).toBe(1)
    })
  })

  describe('pull()', () => {
    it('returns the last item', () => {
      const item1 = {}
      const item2 = {}
      lifoList.push(item1)
      lifoList.push(item2)
      expect(lifoList.pull()).toBe(item2)
    })

    it('removes the last item it returns', () => {
      const item1 = {}
      const item2 = {}
      lifoList.push(item1)
      lifoList.push(item2)
      lifoList.pull()
      expect(lifoList.size()).toBe(1)
    })

    it('returns the earlier item on the next pull', () => {
      const item1 = {}
      const item2 = {}
      lifoList.push(item1)
      lifoList.push(item2)
      lifoList.pull()
      expect(lifoList.pull()).toBe(item1)
    })

    it('empties the list once every item is pulled', () => {
      const item1 = {}
      const item2 = {}
      lifoList.push(item1)
      lifoList.push(item2)
      lifoList.pull()
      lifoList.pull()
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
    it('returns true when it deletes an item', () => {
      const item = {}
      lifoList.push(item)
      expect(lifoList.remove(item)).toBe(true)
    })

    it('deletes the item from the list', () => {
      const item = {}
      lifoList.push(item)
      lifoList.remove(item)
      expect(lifoList.has(item)).toBe(false)
    })

    it('returns false if item does not exist', () => {
      expect(lifoList.remove({})).toBe(false)
    })
  })

  describe('has()', () => {
    it('returns true for an item in the list', () => {
      const item = {}
      lifoList.push(item)
      expect(lifoList.has(item)).toBe(true)
    })

    it('returns false for an item outside the list', () => {
      const item = {}
      lifoList.push(item)
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
