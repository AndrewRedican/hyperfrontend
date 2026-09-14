import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { deregisterIterableClass } from './deregister-iterable-class'
import { locateCircularReference } from './locate-circular-reference'
import { registerIterableClass } from './register-iterable-class'
import { setConfig, getConfig } from './shared/consts'

describe('locateCircularReference', () => {
  let input: unknown

  beforeEach(() => {
    const ar: unknown[] = []
    ar[0] = ar
    const ob = { a: { b: { c: {} } } }
    ob.a.b.c = ob
    input = { ar, ob }
  })

  it('throws an error when incorrect arguments are passed', () => {
    // @ts-expect-error TS2345 - deliberately passing wrong parameters
    expect(() => locateCircularReference(null, null)).toThrow('Invalid maxResults argument.')
    // @ts-expect-error TS2345 - deliberately passing wrong parameters
    expect(() => locateCircularReference(null, '@')).toThrow('Invalid maxResults argument.')
    expect(() => locateCircularReference(null, -10)).toThrow('Invalid maxResults argument.')
  })

  it('returns an empty list when no circular references found', () => {
    expect(locateCircularReference(void 0)).toEqual([])
    expect(locateCircularReference(null)).toEqual([])
    expect(locateCircularReference(0)).toEqual([])
    expect(locateCircularReference({})).toEqual([])
    expect(locateCircularReference([])).toEqual([])
    expect(locateCircularReference({ a: [{ l: ['a', 'b'] }] })).toEqual([])
  })

  it('returns first of circular reference encountered by default', () => {
    expect(locateCircularReference(input).length).toEqual(1)
  })

  it('returns a list of circular references', () => {
    const result = locateCircularReference(input, '*')
    expect(result.length).toEqual(2)
    expect(result[0].toString()).toEqual('ar·0 → ar')
    expect(result[1].toString()).toEqual('ob·a·b·c → ob')
  })

  it('returns a designated maximum circular references', () => {
    expect(locateCircularReference(input, 1).length).toEqual(1)
  })
})

describe('locateCircularReference - with references shared between branches', () => {
  it('returns an empty list when the same object is reachable through two keys', () => {
    const shared = { v: 1 }
    expect(locateCircularReference({ a: shared, b: shared }, '*')).toEqual([])
  })

  it('returns an empty list when the same object is reachable through two array items', () => {
    const shared = { v: 1 }
    expect(locateCircularReference([shared, shared], '*')).toEqual([])
  })

  it('reports the ancestor the cycle points at when a sibling subtree was visited first', () => {
    const cycle: Record<string, unknown> = { x: { y: {} } }
    cycle['e'] = { f: cycle }
    expect(locateCircularReference({ d: cycle }, '*').map((reference) => reference.toString())).toEqual(['d·e·f → d'])
  })

  it('reports the depth of a cycle found after a sibling subtree was visited', () => {
    const cycle: Record<string, unknown> = { x: { y: {} } }
    cycle['e'] = { f: cycle }
    expect(locateCircularReference({ d: cycle }, '*')[0].depth).toEqual(2)
  })

  it('reports a cycle that sits behind a shared reference', () => {
    const shared: Record<string, unknown> = { v: 1 }
    shared['self'] = shared
    expect(locateCircularReference({ a: shared, b: shared }, '*').map((reference) => reference.toString())).toEqual([
      'a·self → a',
      'b·self → b',
    ])
  })
})

describe('locateCircularReference - with non-extensible input', () => {
  it('returns an empty list for a frozen acyclic value', () => {
    expect(locateCircularReference(Object.freeze({ a: Object.freeze({ b: 1 }) }), '*')).toEqual([])
  })

  it('returns an empty list for a sealed acyclic value', () => {
    expect(locateCircularReference(Object.seal({ a: 1 }), '*')).toEqual([])
  })

  it('locates the cycle in a frozen value that contains itself', () => {
    const target: Record<string, unknown> = { a: 1 }
    target['self'] = target
    Object.freeze(target)
    expect(locateCircularReference(target, '*').map((reference) => reference.toString())).toEqual(['self → '])
  })
})

describe('locateCircularReference - when reading a value throws', () => {
  it('restores the configuration it turned on', () => {
    const target = {
      get explode(): unknown {
        throw new Error('reader exploded')
      },
    }
    expect(() => locateCircularReference(target)).toThrow('reader exploded')
    expect(getConfig().detectCircularReferences).toBe(false)
  })
})

describe('locateCircularReference - with extended iterable class types', () => {
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

  it('returns a list of circular references are encountered', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = new Map<string, Map<string, any>>()
    map.set('emerald', map)
    map.set('ruby', map)
    map.set('sapphire', map)
    expect(locateCircularReference(map, '*').length).toEqual(3)
  })
})

describe('locateCircularReference - with detectCircularReferences already enabled', () => {
  let input: unknown

  beforeEach(() => {
    setConfig({ detectCircularReferences: true })
    const ar: unknown[] = []
    ar[0] = ar
    const ob = { a: { b: { c: {} } } }
    ob.a.b.c = ob
    input = { ar, ob }
  })

  afterEach(() => {
    setConfig({ detectCircularReferences: false })
  })

  it('returns list of circular references when config is already enabled', () => {
    expect(getConfig().detectCircularReferences).toBe(true)
    const result = locateCircularReference(input, '*')
    expect(result.length).toEqual(2)
    expect(getConfig().detectCircularReferences).toBe(true)
  })

  it('returns empty list when no circular references when config is already enabled', () => {
    expect(getConfig().detectCircularReferences).toBe(true)
    expect(locateCircularReference({})).toEqual([])
    expect(locateCircularReference({ a: { b: { c: {} } } })).toEqual([])
    expect(getConfig().detectCircularReferences).toBe(true)
  })
})
