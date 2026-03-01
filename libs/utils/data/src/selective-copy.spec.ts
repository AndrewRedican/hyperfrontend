/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-empty-function */
import { deregisterIterableClass } from './deregister-iterable-class'
import { isIdentical } from './is-identical'
import { registerIterableClass } from './register-iterable-class'
import { selectiveCopy } from './selective-copy'
import { setConfig } from './shared/consts'

describe('selectiveCopy', () => {
  it('clones primitive type data', () => {
    const symbol = Symbol()
    expect(selectiveCopy(symbol).clone).toEqual(symbol)
    expect(selectiveCopy('open sesame').clone).toEqual('open sesame')
    expect(selectiveCopy(5).clone).toEqual(5)
    expect(selectiveCopy(NaN).clone).toEqual(NaN)
    expect(selectiveCopy(true).clone).toEqual(true)
    expect(selectiveCopy(BigInt(9007199254740991)).clone).toEqual(BigInt(9007199254740991))
    expect(selectiveCopy(void 0).clone).toBeUndefined()
    expect(selectiveCopy(null).clone).toBeNull()
    const fn = () => {}
    expect(selectiveCopy(fn).clone).toEqual(fn)
  })

  it('throw error when second argument is not an object', () => {
    expect(() => selectiveCopy(5, null)).toThrow('Invalid options argument.')

    // @ts-expect-error Testing invalid input
    expect(() => selectiveCopy(5, [])).toThrow('Invalid options argument.')
  })

  it('does not allow more than one behaviour to be specified', () => {
    expect(() => selectiveCopy(42, { includeKeys: [], exclude: () => true })).toThrow(
      'Options includeKeys and exclude are mutually exclusive.'
    )
  })

  it('copies function references by default', () => {
    const target = { method: () => true }
    const { clone, skipped } = selectiveCopy(target)
    expect(clone.method).toBe(target.method)
    expect(skipped).toEqual([])
  })

  it('skips copying functions when flagged', () => {
    const target = { method: () => true }
    const { clone, skipped } = selectiveCopy(target, { skipFunctions: true })
    expect(clone).toEqual({})
    expect(skipped).toEqual([
      {
        target: target.method,
        path: ['method'],
        key: 'method',
        dataType: 'function',
      },
    ])
  })

  it('copies top-level keys that have been specified', () => {
    const target = { a: 5, b: 'hello world', c: [0] }
    const { clone, skipped } = selectiveCopy(target, {
      includeKeys: ['b', 'c'],
    })
    expect(clone).toEqual({ b: 'hello world', c: [0] })
    expect(skipped).toEqual([{ target: 5, path: ['a'], key: 'a', dataType: 'number' }])
  })

  it('does not copy top-level keys that have been specified', () => {
    const target = { a: 7, b: 'foo bar', c: { b: 'hey' } }
    const { clone, skipped } = selectiveCopy(target, { excludeKeys: ['b'] })
    expect(clone).toEqual({ a: 7, c: { b: 'hey' } })
    expect(skipped).toEqual([{ target: 'foo bar', path: ['b'], key: 'b', dataType: 'string' }])
  })

  it('selectively copies based on include callback', () => {
    const target = { a: 7, b: 'foo bar', c: { b: 'hey' } }
    const { clone, skipped } = selectiveCopy(target, {
      include: (target, path, key, dataType) => ['object', 'string'].includes(dataType),
    })
    expect(clone).toEqual({ b: 'foo bar', c: { b: 'hey' } })
    expect(skipped).toEqual([{ target: 7, path: ['a'], key: 'a', dataType: 'number' }])
  })

  it('selectively copies based on exclude callback', () => {
    const target = ['lorem', 'ipsum', 'suet', 'corvi']

    const { clone, skipped } = selectiveCopy(target, {
      exclude: (target, path, key, dataType) => +key > 1,
    })
    expect(clone).toEqual(['lorem', 'ipsum'])
    expect(skipped).toEqual([
      { target: 'suet', path: ['2'], key: '2', dataType: 'string' },
      { target: 'corvi', path: ['3'], key: '3', dataType: 'string' },
    ])
  })

  it('supports custom classes', () => {
    registerIterableClass<Map<unknown, unknown>>(
      Map,
      (map) => Array.from(map.keys()) as string[],
      (map, key) => map.get(key),
      (map, value, key) => map.set(key, value),
      (map, key) => map.delete(key)
    )
    const target = { collection: new Map().set('blue', '#0000FF') }
    expect(selectiveCopy(target).clone).toEqual({
      collection: new Map().set('blue', '#0000FF'),
    })
    deregisterIterableClass(Map)
  })

  it('safely handles symbol keys (which are always safe)', () => {
    class CustomObject {
      [key: string]: unknown
      constructor() {
        const sym = Symbol('testKey')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(<any>this)[sym] = 'symbolValue'
        this['regular'] = 'value'
      }
    }
    registerIterableClass<CustomObject>(
      CustomObject,
      (obj) => {
        const stringKeys = Object.keys(obj)
        const symbolKeys = Object.getOwnPropertySymbols(obj)
        return [...stringKeys, ...(<string[]>(<unknown>symbolKeys))]
      },
      (obj, key) => (<Record<string | symbol, unknown>>obj)[<string | symbol>key],
      (obj, value, key) => ((<Record<string | symbol, unknown>>obj)[<string | symbol>key] = value),
      (obj, key) => delete (<Record<string | symbol, unknown>>obj)[<string | symbol>key]
    )
    const target = new CustomObject()
    const { clone } = selectiveCopy(target)
    expect(clone).toHaveProperty('regular', 'value')
    deregisterIterableClass(CustomObject)
  })
})

describe('selectiveCopy - with config detectCircularReferences:true', () => {
  beforeEach(() => setConfig({ detectCircularReferences: true }))

  afterEach(() => {
    setConfig({ detectCircularReferences: false })
    // Clean up any potential pollution from tests
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (<any>Object.prototype).polluted
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (<any>Object.prototype).value
  })

  it('clones primitive type data', () => {
    const symbol = Symbol()
    expect(selectiveCopy(symbol).clone).toEqual(symbol)
    expect(selectiveCopy('open sesame').clone).toEqual('open sesame')
    expect(selectiveCopy(5).clone).toEqual(5)
    expect(selectiveCopy(NaN).clone).toEqual(NaN)
    expect(selectiveCopy(true).clone).toEqual(true)
    expect(selectiveCopy(BigInt(9007199254740991)).clone).toEqual(BigInt(9007199254740991))
    expect(selectiveCopy(void 0).clone).toBeUndefined()
    expect(selectiveCopy(null).clone).toBeNull()
    const fn = () => {}
    expect(selectiveCopy(fn).clone).toEqual(fn)
  })

  it('throw error when second argument is not an object', () => {
    expect(() => selectiveCopy(5, null)).toThrow('Invalid options argument.')

    // @ts-expect-error Testing invalid input
    expect(() => selectiveCopy(5, [])).toThrow('Invalid options argument.')
  })

  it('does not allow more than one behaviour to be specified', () => {
    expect(() => selectiveCopy(42, { includeKeys: [], exclude: () => true })).toThrow(
      'Options includeKeys and exclude are mutually exclusive.'
    )
  })

  it('copies function references by default', () => {
    const target = { method: () => true }
    const { clone, skipped } = selectiveCopy(target)
    expect(clone.method).toBe(target.method)
    expect(skipped).toEqual([])
  })

  it('skips copying functions when flagged', () => {
    const target = { method: () => true }
    const { clone, skipped } = selectiveCopy(target, { skipFunctions: true })
    expect(clone).toEqual({})
    expect(skipped).toEqual([
      {
        target: target.method,
        path: ['method'],
        key: 'method',
        dataType: 'function',
      },
    ])
  })

  it('copies top-level keys that have been specified', () => {
    const target = { a: 5, b: 'hello world', c: [0] }
    const { clone, skipped } = selectiveCopy(target, {
      includeKeys: ['b', 'c'],
    })
    expect(clone).toEqual({ b: 'hello world', c: [0] })
    expect(skipped).toEqual([{ target: 5, path: ['a'], key: 'a', dataType: 'number' }])
  })

  it('does not copy top-level keys that have been specified', () => {
    const target = { a: 7, b: 'foo bar', c: { b: 'hey' } }
    const { clone, skipped } = selectiveCopy(target, { excludeKeys: ['b'] })
    expect(clone).toEqual({ a: 7, c: { b: 'hey' } })
    expect(skipped).toEqual([{ target: 'foo bar', path: ['b'], key: 'b', dataType: 'string' }])
  })

  it('selectively copies based on include callback', () => {
    const target = { a: 7, b: 'foo bar', c: { b: 'hey' } }
    const { clone, skipped } = selectiveCopy(target, {
      include: (target, path, key, dataType) => ['object', 'string'].includes(dataType),
    })
    expect(clone).toEqual({ b: 'foo bar', c: { b: 'hey' } })
    expect(skipped).toEqual([{ target: 7, path: ['a'], key: 'a', dataType: 'number' }])
  })

  it('selectively copies based on exclude callback', () => {
    const target = ['lorem', 'ipsum', 'suet', 'corvi']

    const { clone, skipped } = selectiveCopy(target, {
      exclude: (target, path, key, dataType) => +key > 1,
    })
    expect(clone).toEqual(['lorem', 'ipsum'])
    expect(skipped).toEqual([
      { target: 'suet', path: ['2'], key: '2', dataType: 'string' },
      { target: 'corvi', path: ['3'], key: '3', dataType: 'string' },
    ])
  })

  it('supports custom classes', () => {
    registerIterableClass<Map<unknown, unknown>>(
      Map,
      (map) => Array.from(map.keys()) as string[],
      (map, key) => map.get(key),
      (map, value, key) => map.set(key, value),
      (map, key) => map.delete(key)
    )
    const target = { collection: new Map().set('blue', '#0000FF') }
    expect(selectiveCopy(target).clone).toEqual({
      collection: new Map().set('blue', '#0000FF'),
    })
    deregisterIterableClass(Map)
  })

  it('recreates circular references', () => {
    const [target, expected] = [{ a: { b: { c: {} } } }, { a: { b: { c: {} } } }]
    target.a.b.c = target.a.b
    expected.a.b.c = expected.a.b
    const { clone } = selectiveCopy(target)
    expect(isIdentical(clone, expected)).toEqual(true)
  })

  it('safely handles symbol keys with circular refs (which are always safe)', () => {
    class CustomObject {
      [key: string]: unknown
      constructor() {
        const sym = Symbol('testKey')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(<any>this)[sym] = 'symbolValue'
        this['regular'] = 'value'
      }
    }
    registerIterableClass<CustomObject>(
      CustomObject,
      (obj) => {
        const stringKeys = Object.keys(obj)
        const symbolKeys = Object.getOwnPropertySymbols(obj)
        return [...stringKeys, ...(<string[]>(<unknown>symbolKeys))]
      },
      (obj, key) => (<Record<string | symbol, unknown>>obj)[<string | symbol>key],
      (obj, value, key) => ((<Record<string | symbol, unknown>>obj)[<string | symbol>key] = value),
      (obj, key) => delete (<Record<string | symbol, unknown>>obj)[<string | symbol>key]
    )
    const target = new CustomObject()
    const { clone } = selectiveCopy(target)
    expect(clone).toHaveProperty('regular', 'value')
    deregisterIterableClass(CustomObject)
  })

  it('recreates circular references with self-reference', () => {
    const target: Record<string, unknown> = { value: 42 }
    target['self'] = target
    const { clone } = selectiveCopy(target)
    expect(<Record<string, unknown>>clone['self']).toBe(clone)
    expect(<Record<string, unknown>>clone['value']).toBe(42)
  })

  it('recreates circular references in arrays', () => {
    const target: unknown[] = [1, 2, 3]
    target.push(target)
    const { clone } = selectiveCopy(target)
    expect(<unknown[]>clone[3]).toBe(clone)
    expect(<unknown[]>clone[0]).toBe(1)
  })
})

describe('selectiveCopy - __proto__ pollution prevention (non-circular)', () => {
  beforeEach(() => setConfig({ detectCircularReferences: false }))

  afterEach(() => {
    setConfig({ detectCircularReferences: false })
    // Clean up any potential pollution from tests
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (<any>Object.prototype).polluted
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (<any>Object.prototype).value
  })

  it('prevents __proto__ pollution during basic copy', () => {
    const malicious: Record<string, unknown> = { safe: 'value' }
    Object.defineProperty(malicious, '__proto__', {
      value: { polluted: true },
      enumerable: true,
      configurable: true,
    })
    const { clone } = selectiveCopy(malicious)
    expect(clone).toEqual({ safe: 'value' })
    expect(Object.keys(clone)).toEqual(['safe'])
    expect(Object.prototype).not.toHaveProperty('polluted')
  })

  it('safely handles nested objects with __proto__ key', () => {
    const nested: Record<string, unknown> = { alsoSafe: 42 }
    Object.defineProperty(nested, '__proto__', {
      value: { polluted: true },
      enumerable: true,
      configurable: true,
    })
    const target = { safe: 'value', nested }
    const { clone } = selectiveCopy(target)
    expect(clone).toEqual({ safe: 'value', nested: { alsoSafe: 42 } })
    expect(Object.keys(<object>(<Record<string, unknown>>clone)['nested'])).toEqual(['alsoSafe'])
    expect(Object.prototype).not.toHaveProperty('polluted')
  })

  it('safely handles arrays with __proto__ property', () => {
    const arr = ['a', 'b', 'c']
    Object.defineProperty(arr, '__proto__', {
      value: { polluted: true },
      enumerable: true,
      configurable: true,
    })
    const { clone } = selectiveCopy(arr)
    expect(clone).toEqual(['a', 'b', 'c'])
    expect(Object.prototype).not.toHaveProperty('polluted')
  })
})

describe('selectiveCopy - __proto__ pollution prevention (circular references)', () => {
  beforeEach(() => setConfig({ detectCircularReferences: true }))

  afterEach(() => {
    setConfig({ detectCircularReferences: false })
    // Clean up any potential pollution from tests
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (<any>Object.prototype).polluted
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (<any>Object.prototype).value
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (<any>Object.prototype).traversal
  })

  it('prevents pollution via __proto__ in circular reference paths', () => {
    const inner: Record<string, unknown> = { value: 'inner' }
    const outer: Record<string, unknown> = { inner }
    Object.defineProperty(inner, '__proto__', {
      value: outer,
      enumerable: true,
      configurable: true,
      writable: true,
    })
    const { clone } = selectiveCopy(outer)
    expect(clone).toHaveProperty('inner')
    expect(clone['inner']).toEqual({ value: 'inner' })
    expect(Object.keys(<Record<string, unknown>>clone['inner'])).toEqual(['value'])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (<any>inner).__proto__
  })

  it('prevents pollution when __proto__ appears in startPath during circular ref resolution', () => {
    const target: Record<string, unknown> = { a: { b: {} } }
    ;(<Record<string, unknown>>target['a'])['b'] = target['a']
    Object.defineProperty(target, '__proto__', {
      value: { polluted: 'bad' },
      enumerable: true,
      configurable: true,
    })
    const { clone } = selectiveCopy(target)
    expect(clone).toHaveProperty('a')
    expect(<Record<string, unknown>>clone['a']).toHaveProperty('b')
    expect(Object.prototype).not.toHaveProperty('polluted')
  })

  it('prevents pollution when __proto__ appears in destinationPath during circular ref resolution', () => {
    const inner: Record<string, unknown> = { safe: 'value' }
    const target: Record<string, unknown> = { inner }
    inner['self'] = inner
    Object.defineProperty(target, '__proto__', {
      value: { polluted: 'bad' },
      enumerable: true,
      configurable: true,
    })
    const { clone } = selectiveCopy(target)
    expect(clone).toHaveProperty('inner')
    expect(<Record<string, unknown>>clone['inner']).toHaveProperty('self')
    expect(<Record<string, unknown>>clone['inner']).toHaveProperty('safe')
    expect(Object.prototype).not.toHaveProperty('polluted')
  })

  it('prevents pollution during path traversal in circular ref resolution', () => {
    const deep: Record<string, unknown> = { level3: {} }
    const mid: Record<string, unknown> = { level2: deep }
    const target: Record<string, unknown> = { level1: mid }
    deep['level3'] = target
    Object.defineProperty(mid, '__proto__', {
      value: { polluted: 'traversal' },
      enumerable: true,
      configurable: true,
    })
    const { clone } = selectiveCopy(target)
    expect(clone).toHaveProperty('level1')
    expect(<Record<string, unknown>>clone['level1']).toHaveProperty('level2')
    expect(Object.prototype).not.toHaveProperty('polluted')
  })
})
