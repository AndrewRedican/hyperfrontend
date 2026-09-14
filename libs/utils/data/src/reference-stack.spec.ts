import type { ReferenceStack } from './models'
import { beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { isMarker } from './is-marker'
import { referenceStack } from './reference-stack'

describe('referenceStack', () => {
  let stack: ReferenceStack

  beforeEach(() => (stack = referenceStack()))

  it('does not interfere with other reference stacks', () => {
    const value = {}
    const stack2 = referenceStack()
    stack.add(value)
    stack2.add(value)
    expect(stack.size).toBe(1)
    expect(stack2.size).toBe(1)
  })

  describe('size', () => {
    it('returns size of stack', () => {
      expect(stack.size).toBe(0)
      stack.add({})
      expect(stack.size).toBe(1)
      stack.add([])
      expect(stack.size).toBe(2)
    })
  })

  describe('exists', () => {
    beforeEach(() => (stack = referenceStack()))

    it('returns true when reference already exists in the stack', () => {
      const value = {}
      stack.add(value)
      expect(stack.exists(value)).toBe(true)
    })

    it('returns false when reference has not been registered in the stack', () => {
      expect(stack.exists({})).toBe(false)
    })

    it('returns false when reference is not iterable', () => {
      expect(stack.exists(42)).toBe(false)
      expect(stack.exists('hello')).toBe(false)
      expect(stack.exists(null)).toBe(false)
      expect(stack.exists(undefined)).toBe(false)
    })
  })

  describe('lastSeen', () => {
    beforeEach(() => (stack = referenceStack()))

    it('returns a number corresponding to how long ago the reference was added to the stack', () => {
      const [a, b, c] = [{}, {}, {}]
      stack.add(a)
      expect(stack.lastSeen(a)).toBe(-1)
      stack.add(b)
      expect(stack.lastSeen(b)).toBe(-1)
      expect(stack.lastSeen(a)).toBe(-2)
      stack.add(c)
      expect(stack.lastSeen(c)).toBe(-1)
      expect(stack.lastSeen(b)).toBe(-2)
      expect(stack.lastSeen(a)).toBe(-3)
    })

    it('returns false when reference is not registered', () => {
      expect(stack.lastSeen({})).toBeNull()
      expect(stack.lastSeen([])).toBeNull()
    })

    it('returns false when reference is not iterable', () => {
      expect(stack.lastSeen(42)).toBeNull()
      expect(stack.lastSeen(null)).toBeNull()
      expect(stack.lastSeen(void 0)).toBeNull()
    })
  })

  describe('add', () => {
    beforeEach(() => (stack = referenceStack()))

    it('reisters a new reference in the stack', () => {
      expect(stack.size).toBe(0)
      stack.add({})
      expect(stack.size).toBe(1)
    })

    it('does not register a reference that already exists in the stack', () => {
      const value: unknown[] = []
      expect(stack.size).toBe(0)
      stack.add(value)
      stack.add(value)
      expect(stack.size).toBe(1)
    })

    it('does not register a reference that is not iterable', () => {
      stack.add(Symbol())
      stack.add(false)
      expect(stack.size).toBe(0)
    })
  })

  describe('remove', () => {
    beforeEach(() => (stack = referenceStack()))

    it('drops a reference that was registered in the stack', () => {
      const value = {}
      stack.add(value)
      stack.remove(value)
      expect(stack.exists(value)).toBe(false)
    })

    it('leaves the references that were not removed', () => {
      const [a, b] = [{}, {}]
      stack.add(a)
      stack.add(b)
      stack.remove(b)
      expect(stack.exists(a)).toBe(true)
    })

    it('ignores a reference that was never registered', () => {
      stack.add({})
      stack.remove({})
      expect(stack.size).toBe(1)
    })

    it('ignores a reference that is not iterable', () => {
      stack.add({})
      stack.remove(42)
      expect(stack.size).toBe(1)
    })

    it('frees the index for the reference added next', () => {
      const [a, b, c] = [{}, {}, {}]
      stack.add(a)
      stack.add(b)
      stack.remove(b)
      stack.add(c)
      expect(stack.lastSeen(a)).toBe(-2)
    })
  })

  describe('clear', () => {
    beforeEach(() => (stack = referenceStack()))

    it('clears the internal stack', () => {
      const value = { a: { b: {} } }
      stack.add(value)
      stack.add(value.a)
      stack.add(value.a.b)
      expect(stack.size).toBe(3)
      stack.clear()
      expect(stack.size).toBe(0)
    })

    it('never writes a marker onto the references it tracks', () => {
      const value = { a: { b: {} } }
      stack.add(value)
      stack.add(value.a)
      stack.add(value.a.b)
      stack.clear()
      expect([value, value.a, value.a.b].flatMap((reference) => Object.keys(reference)).some(isMarker)).toBe(false)
    })
  })
})
