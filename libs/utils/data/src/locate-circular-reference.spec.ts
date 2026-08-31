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
