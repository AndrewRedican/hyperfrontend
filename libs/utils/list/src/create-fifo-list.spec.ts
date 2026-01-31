import type { FifoList } from './create-fifo-list'
import { createFifoList } from './create-fifo-list'

describe('createFifoList', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fifoList: FifoList<any>

  beforeEach(() => {
    fifoList = createFifoList()
  })

  describe('push()', () => {
    it('adds items correctly', () => {
      const item = {}
      fifoList.push(item)
      expect(fifoList.size()).toBe(1)
    })

    it('throws an error for primitives', () => {
      expect(() => fifoList.push(5)).toThrow()
    })

    it('throws an error for duplicate items', () => {
      const item = {}
      fifoList.push(item)
      expect(() => fifoList.push(item)).toThrow()
    })
  })

  describe('pull()', () => {
    it('removes and returns the first item', () => {
      const item = {}
      fifoList.push(item)
      expect(fifoList.pull()).toBe(item)
      expect(fifoList.size()).toBe(0)
    })

    it('returns undefined if list is empty', () => {
      expect(fifoList.pull()).toBeUndefined()
    })
  })

  describe('map()', () => {
    it('applies a function to each element', () => {
      fifoList.push({ value: 1 })
      fifoList.push({ value: 2 })
      const result = fifoList.map((item) => item.value * 2)
      expect(result).toEqual([2, 4])
    })
  })

  describe('forEach()', () => {
    it('executes a function for each item', () => {
      fifoList.push({ value: 1 })
      fifoList.push({ value: 2 })
      const mockCallback = jest.fn()
      fifoList.forEach(mockCallback)
      expect(mockCallback.mock.calls.length).toBe(2)
    })
  })

  describe('remove()', () => {
    it('deletes an item and returns true', () => {
      const item = {}
      fifoList.push(item)
      expect(fifoList.remove(item)).toBe(true)
      expect(fifoList.has(item)).toBe(false)
    })

    it('returns false if item does not exist', () => {
      expect(fifoList.remove({})).toBe(false)
    })
  })

  describe('has()', () => {
    it('checks if an item exists in the list', () => {
      const item = {}
      fifoList.push(item)
      expect(fifoList.has(item)).toBe(true)
      expect(fifoList.has({})).toBe(false)
    })
  })

  describe('size()', () => {
    it('returns the number of items', () => {
      fifoList.push({})
      fifoList.push({})
      expect(fifoList.size()).toBe(2)
    })
  })

  describe('clear()', () => {
    it('removes all items from the list', () => {
      fifoList.push({})
      fifoList.push({})
      fifoList.clear()
      expect(fifoList.size()).toBe(0)
    })
  })
})
