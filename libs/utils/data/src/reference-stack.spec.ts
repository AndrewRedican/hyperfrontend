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
    expect({ stack: stack.size, stack2: stack2.size }).toEqual({ stack: 1, stack2: 1 })
  })

  describe('size', () => {
    it('returns size of stack', () => {
      const empty = stack.size
      stack.add({})
      const afterOneAdd = stack.size
      stack.add([])
      expect({ empty, afterOneAdd, afterTwoAdds: stack.size }).toEqual({ empty: 0, afterOneAdd: 1, afterTwoAdds: 2 })
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

    it.each([[42], ['hello'], [null], [undefined]])('returns false when reference %p is not iterable', (value: unknown) => {
      expect(stack.exists(value)).toBe(false)
    })
  })

  describe('lastSeen', () => {
    beforeEach(() => (stack = referenceStack()))

    it('returns a number corresponding to how long ago the reference was added to the stack', () => {
      const [a, b, c] = [{}, {}, {}]
      stack.add(a)
      const afterAddingA = { a: stack.lastSeen(a) }
      stack.add(b)
      const afterAddingB = { b: stack.lastSeen(b), a: stack.lastSeen(a) }
      stack.add(c)
      const afterAddingC = { c: stack.lastSeen(c), b: stack.lastSeen(b), a: stack.lastSeen(a) }
      expect({ afterAddingA, afterAddingB, afterAddingC }).toEqual({
        afterAddingA: { a: -1 },
        afterAddingB: { b: -1, a: -2 },
        afterAddingC: { c: -1, b: -2, a: -3 },
      })
    })

    it.each([[{}], [[]]])('returns null when reference %p is not registered', (value: unknown) => {
      expect(stack.lastSeen(value)).toBeNull()
    })

    it.each([[42], [null], [void 0]])('returns null when reference %p is not iterable', (value: unknown) => {
      expect(stack.lastSeen(value)).toBeNull()
    })
  })

  describe('add', () => {
    beforeEach(() => (stack = referenceStack()))

    it('reisters a new reference in the stack', () => {
      const before = stack.size
      stack.add({})
      expect({ before, after: stack.size }).toEqual({ before: 0, after: 1 })
    })

    it('does not register a reference that already exists in the stack', () => {
      const value: unknown[] = []
      const before = stack.size
      stack.add(value)
      stack.add(value)
      expect({ before, after: stack.size }).toEqual({ before: 0, after: 1 })
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
      const beforeClear = stack.size
      stack.clear()
      expect({ beforeClear, afterClear: stack.size }).toEqual({ beforeClear: 3, afterClear: 0 })
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
