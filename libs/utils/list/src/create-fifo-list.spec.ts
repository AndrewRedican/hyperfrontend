import type { FifoList } from './create-fifo-list'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createFifoList } from './create-fifo-list'

describe('createFifoList', () => {
  // lint-disable-next-line typescript/no-explicit-any
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

    it('throws an error for null', () => {
      expect(() => fifoList.push(null)).toThrow()
    })

    it('accepts an array', () => {
      fifoList.push([1, 2])
      expect(fifoList.size()).toBe(1)
    })

    it('accepts a function', () => {
      fifoList.push(() => undefined)
      expect(fifoList.size()).toBe(1)
    })

    it('accepts a class instance', () => {
      class Task {}
      fifoList.push(new Task())
      expect(fifoList.size()).toBe(1)
    })

    it('throws an error for duplicate items', () => {
      const item = {}
      fifoList.push(item)
      expect(() => fifoList.push(item)).toThrow()
    })
  })

  describe('pull()', () => {
    it('returns the first item', () => {
      const item = {}
      fifoList.push(item)
      expect(fifoList.pull()).toBe(item)
    })

    it('removes the item it returns', () => {
      const item = {}
      fifoList.push(item)
      fifoList.pull()
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
    it('returns true when it deletes an item', () => {
      const item = {}
      fifoList.push(item)
      expect(fifoList.remove(item)).toBe(true)
    })

    it('deletes the item from the list', () => {
      const item = {}
      fifoList.push(item)
      fifoList.remove(item)
      expect(fifoList.has(item)).toBe(false)
    })

    it('returns false if item does not exist', () => {
      expect(fifoList.remove({})).toBe(false)
    })
  })

  describe('has()', () => {
    it('returns true for an item in the list', () => {
      const item = {}
      fifoList.push(item)
      expect(fifoList.has(item)).toBe(true)
    })

    it('returns false for an item outside the list', () => {
      const item = {}
      fifoList.push(item)
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
