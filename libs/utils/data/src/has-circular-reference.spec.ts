import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { deregisterIterableClass } from './deregister-iterable-class'
import { hasCircularReference } from './has-circular-reference'
import { registerIterableClass } from './register-iterable-class'
import { setConfig, getConfig } from './shared/consts'

describe('hasCircularReference', () => {
  it.each([[5], ['foo bar'], [null], [void 0], [Symbol()], [true]])('returns false for the non-iterable value %p', (value: unknown) => {
    expect(hasCircularReference(value)).toEqual(false)
  })

  it.each([[{}], [[]], [{ a: { b: { c: {} } } }]])(
    'returns false for the iterable value %p that does not have circular references',
    (value: unknown) => {
      expect(hasCircularReference(value)).toEqual(false)
    }
  )

  it('returns true for an array that contains itself', () => {
    const selfContainingArray: unknown[] = []
    selfContainingArray[0] = selfContainingArray
    expect(hasCircularReference(selfContainingArray)).toEqual(true)
  })

  it('returns true for an object that references itself from a nested value', () => {
    const selfReferencingObject = { a: { b: { c: {} } } }
    selfReferencingObject.a.b.c = selfReferencingObject
    expect(hasCircularReference(selfReferencingObject)).toEqual(true)
  })
})

describe('hasCircularReference - with references shared between branches', () => {
  it('returns false when the same object is reachable through two keys', () => {
    const shared = { v: 1 }
    expect(hasCircularReference({ a: shared, b: shared })).toEqual(false)
  })

  it('returns false when the same object is reachable through two array items', () => {
    const shared = { v: 1 }
    expect(hasCircularReference([shared, shared])).toEqual(false)
  })

  it('returns false when a shared branch is deeper than the branch that follows it', () => {
    const shared = { deep: { deeper: {} } }
    expect(hasCircularReference({ a: shared, b: { c: shared } })).toEqual(false)
  })
})

describe('hasCircularReference - with non-extensible input', () => {
  it('returns false for a frozen object', () => {
    expect(hasCircularReference(Object.freeze({ a: 1 }))).toEqual(false)
  })

  it('returns false for an object holding a frozen object', () => {
    expect(hasCircularReference({ a: Object.freeze({ b: 1 }) })).toEqual(false)
  })

  it('returns false for a sealed object', () => {
    expect(hasCircularReference(Object.seal({ a: 1 }))).toEqual(false)
  })

  it('returns false for a frozen array', () => {
    expect(hasCircularReference(Object.freeze([1, 2]))).toEqual(false)
  })

  it('returns true for a frozen value that contains itself', () => {
    const target: Record<string, unknown> = { a: 1 }
    target['self'] = target
    Object.freeze(target)
    expect(hasCircularReference(target)).toEqual(true)
  })

  it('leaves no key behind on the values it visits', () => {
    const target = { a: { b: 1 } }
    hasCircularReference(target)
    expect(Object.keys(target.a)).toEqual(['b'])
  })
})

describe('hasCircularReference - when reading a value throws', () => {
  it('lets the error thrown by the reader propagate', () => {
    const target = {
      get explode(): unknown {
        throw new Error('reader exploded')
      },
    }
    expect(() => hasCircularReference(target)).toThrow('reader exploded')
  })

  it('restores the configuration it turned on', () => {
    const target = {
      get explode(): unknown {
        throw new Error('reader exploded')
      },
    }
    try {
      hasCircularReference(target)
    } catch {
      // note: the reader's error only triggers the restore here; the test above pins that it propagates.
    }
    expect(getConfig().detectCircularReferences).toBe(false)
  })
})

describe('hasCircularReference - with extended iterable class types', () => {
  beforeEach(() => {
    registerIterableClass<Map<unknown, unknown>>(
      Map,
      (map) => Array.from(map.keys()) as string[],
      (map, key) => map.get(key),
      (map, value, key) => map.set(key, value),
      (map, key) => map.delete(key)
    )
  })

  afterEach(() => deregisterIterableClass())

  it('returns false when no circular references are encountered', () => {
    const map = new Map<string, number>()
    map.set('sapphire', 35)
    expect(hasCircularReference(map)).toEqual(false)
  })

  it('returns true when encountering a circular reference', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = new Map<string, Map<string, any>>()
    map.set('emerald', map)
    expect(hasCircularReference(map)).toEqual(true)
  })
})

describe('hasCircularReference - with detectCircularReferences already enabled', () => {
  beforeEach(() => {
    setConfig({ detectCircularReferences: true })
  })

  afterEach(() => {
    setConfig({ detectCircularReferences: false })
  })

  it.each([[{}], [{ a: { b: { c: {} } } }]])(
    'returns false for the value %p without circular references when config is already enabled',
    (value: unknown) => {
      expect(hasCircularReference(value)).toEqual(false)
    }
  )

  it('leaves the already enabled config enabled after checking values without circular references', () => {
    const before = getConfig().detectCircularReferences
    hasCircularReference({})
    hasCircularReference({ a: { b: { c: {} } } })
    expect({ before, after: getConfig().detectCircularReferences }).toEqual({ before: true, after: true })
  })

  it('returns true for values with circular references when config is already enabled', () => {
    const selfReferencingObject = { a: { b: { c: {} } } }
    selfReferencingObject.a.b.c = selfReferencingObject
    expect(hasCircularReference(selfReferencingObject)).toEqual(true)
  })

  it('leaves the already enabled config enabled after checking a value with circular references', () => {
    const before = getConfig().detectCircularReferences
    const selfReferencingObject = { a: { b: { c: {} } } }
    selfReferencingObject.a.b.c = selfReferencingObject
    hasCircularReference(selfReferencingObject)
    expect({ before, after: getConfig().detectCircularReferences }).toEqual({ before: true, after: true })
  })
})
