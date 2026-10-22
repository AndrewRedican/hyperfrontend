/* lint-disable typescript/no-unused-vars */
/* lint-disable typescript/no-empty-function */
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { deregisterIterableClass } from './deregister-iterable-class'
import { isIdentical } from './is-identical'
import { registerIterableClass } from './register-iterable-class'
import { selectiveCopy } from './selective-copy'
import { setConfig } from './shared/consts'

describe('selectiveCopy', () => {
  it.each([[Symbol()], ['open sesame'], [5], [NaN], [true], [BigInt(9007199254740991)], [void 0], [null], [() => {}]])(
    'clones primitive type data: %p',
    (value: unknown) => {
      expect(selectiveCopy(value).clone).toEqual(value)
    }
  )

  it('throws error when the second argument is null instead of an object', () => {
    expect(() => selectiveCopy(5, null)).toThrow('Invalid options argument.')
  })

  it('throws error when the second argument is an array instead of an object', () => {
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
    expect(selectiveCopy(target)).toEqual({ clone: { method: target.method }, skipped: [] })
  })

  it('skips copying functions when flagged', () => {
    const target = { method: () => true }
    expect(selectiveCopy(target, { skipFunctions: true })).toEqual({
      clone: {},
      skipped: [
        {
          target: target.method,
          path: ['method'],
          key: 'method',
          dataType: 'function',
        },
      ],
    })
  })

  it('copies top-level keys that have been specified', () => {
    const target = { a: 5, b: 'hello world', c: [0] }
    expect(
      selectiveCopy(target, {
        includeKeys: ['b', 'c'],
      })
    ).toEqual({
      clone: { b: 'hello world', c: [0] },
      skipped: [{ target: 5, path: ['a'], key: 'a', dataType: 'number' }],
    })
  })

  it('does not copy top-level keys that have been specified', () => {
    const target = { a: 7, b: 'foo bar', c: { b: 'hey' } }
    expect(selectiveCopy(target, { excludeKeys: ['b'] })).toEqual({
      clone: { a: 7, c: { b: 'hey' } },
      skipped: [{ target: 'foo bar', path: ['b'], key: 'b', dataType: 'string' }],
    })
  })

  it('selectively copies based on include callback', () => {
    const target = { a: 7, b: 'foo bar', c: { b: 'hey' } }
    expect(
      selectiveCopy(target, {
        include: (target, path, key, dataType) => ['object', 'string'].includes(dataType),
      })
    ).toEqual({
      clone: { b: 'foo bar', c: { b: 'hey' } },
      skipped: [{ target: 7, path: ['a'], key: 'a', dataType: 'number' }],
    })
  })

  it('selectively copies based on exclude callback', () => {
    const target = ['lorem', 'ipsum', 'suet', 'corvi']

    expect(
      selectiveCopy(target, {
        exclude: (target, path, key, dataType) => +key > 1,
      })
    ).toEqual({
      clone: ['lorem', 'ipsum'],
      skipped: [
        { target: 'suet', path: ['2'], key: '2', dataType: 'string' },
        { target: 'corvi', path: ['3'], key: '3', dataType: 'string' },
      ],
    })
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
        // lint-disable-next-line typescript/no-explicit-any
        ;(this as any)[sym] = 'symbolValue'
        this['regular'] = 'value'
      }
    }
    registerIterableClass<CustomObject>(
      CustomObject,
      (obj) => {
        const stringKeys = Object.keys(obj)
        const symbolKeys = Object.getOwnPropertySymbols(obj)
        return [...stringKeys, ...(symbolKeys as unknown as string[])]
      },
      (obj, key) => (obj as Record<string | symbol, unknown>)[key as string | symbol],
      (obj, value, key) => ((obj as Record<string | symbol, unknown>)[key as string | symbol] = value),
      (obj, key) => delete (obj as Record<string | symbol, unknown>)[key as string | symbol]
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
    // lint-disable-next-line typescript/no-explicit-any
    delete (Object.prototype as any).polluted
    // lint-disable-next-line typescript/no-explicit-any
    delete (Object.prototype as any).value
  })

  it.each([[Symbol()], ['open sesame'], [5], [NaN], [true], [BigInt(9007199254740991)], [void 0], [null], [() => {}]])(
    'clones primitive type data: %p',
    (value: unknown) => {
      expect(selectiveCopy(value).clone).toEqual(value)
    }
  )

  it('throws error when the second argument is null instead of an object', () => {
    expect(() => selectiveCopy(5, null)).toThrow('Invalid options argument.')
  })

  it('throws error when the second argument is an array instead of an object', () => {
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
    expect(selectiveCopy(target)).toEqual({ clone: { method: target.method }, skipped: [] })
  })

  it('skips copying functions when flagged', () => {
    const target = { method: () => true }
    expect(selectiveCopy(target, { skipFunctions: true })).toEqual({
      clone: {},
      skipped: [
        {
          target: target.method,
          path: ['method'],
          key: 'method',
          dataType: 'function',
        },
      ],
    })
  })

  it('copies top-level keys that have been specified', () => {
    const target = { a: 5, b: 'hello world', c: [0] }
    expect(
      selectiveCopy(target, {
        includeKeys: ['b', 'c'],
      })
    ).toEqual({
      clone: { b: 'hello world', c: [0] },
      skipped: [{ target: 5, path: ['a'], key: 'a', dataType: 'number' }],
    })
  })

  it('does not copy top-level keys that have been specified', () => {
    const target = { a: 7, b: 'foo bar', c: { b: 'hey' } }
    expect(selectiveCopy(target, { excludeKeys: ['b'] })).toEqual({
      clone: { a: 7, c: { b: 'hey' } },
      skipped: [{ target: 'foo bar', path: ['b'], key: 'b', dataType: 'string' }],
    })
  })

  it('selectively copies based on include callback', () => {
    const target = { a: 7, b: 'foo bar', c: { b: 'hey' } }
    expect(
      selectiveCopy(target, {
        include: (target, path, key, dataType) => ['object', 'string'].includes(dataType),
      })
    ).toEqual({
      clone: { b: 'foo bar', c: { b: 'hey' } },
      skipped: [{ target: 7, path: ['a'], key: 'a', dataType: 'number' }],
    })
  })

  it('selectively copies based on exclude callback', () => {
    const target = ['lorem', 'ipsum', 'suet', 'corvi']

    expect(
      selectiveCopy(target, {
        exclude: (target, path, key, dataType) => +key > 1,
      })
    ).toEqual({
      clone: ['lorem', 'ipsum'],
      skipped: [
        { target: 'suet', path: ['2'], key: '2', dataType: 'string' },
        { target: 'corvi', path: ['3'], key: '3', dataType: 'string' },
      ],
    })
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
        // lint-disable-next-line typescript/no-explicit-any
        ;(this as any)[sym] = 'symbolValue'
        this['regular'] = 'value'
      }
    }
    registerIterableClass<CustomObject>(
      CustomObject,
      (obj) => {
        const stringKeys = Object.keys(obj)
        const symbolKeys = Object.getOwnPropertySymbols(obj)
        return [...stringKeys, ...(symbolKeys as unknown as string[])]
      },
      (obj, key) => (obj as Record<string | symbol, unknown>)[key as string | symbol],
      (obj, value, key) => ((obj as Record<string | symbol, unknown>)[key as string | symbol] = value),
      (obj, key) => delete (obj as Record<string | symbol, unknown>)[key as string | symbol]
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
    expect(clone['self'] as Record<string, unknown>).toBe(clone)
  })

  it('copies the other values of an object with a self-reference', () => {
    const target: Record<string, unknown> = { value: 42 }
    target['self'] = target
    const { clone } = selectiveCopy(target)
    expect(clone['value'] as Record<string, unknown>).toBe(42)
  })

  it('recreates circular references in arrays', () => {
    const target: unknown[] = [1, 2, 3]
    target.push(target)
    const { clone } = selectiveCopy(target)
    expect(clone[3] as unknown[]).toBe(clone)
  })

  it('copies the other items of an array with a self-reference', () => {
    const target: unknown[] = [1, 2, 3]
    target.push(target)
    const { clone } = selectiveCopy(target)
    expect(clone.slice(0, 3)).toEqual([1, 2, 3])
  })
})

describe('selectiveCopy - with references shared between branches', () => {
  beforeEach(() => setConfig({ detectCircularReferences: true }))

  afterEach(() => setConfig({ detectCircularReferences: false }))

  it('copies a shared reference into both branches', () => {
    const shared = { v: 1 }
    expect(selectiveCopy({ a: shared, b: shared }).clone).toEqual({ a: { v: 1 }, b: { v: 1 } })
  })

  it('does not wire the second branch back to the clone', () => {
    const shared = { v: 1 }
    const clone = selectiveCopy({ a: shared, b: shared }).clone
    expect(clone.b).not.toBe(clone)
  })

  it('produces a clone that can be serialized', () => {
    const shared = { v: 1 }
    const clone = selectiveCopy({ a: shared, b: shared }).clone
    expect(JSON.stringify(clone)).toEqual('{"a":{"v":1},"b":{"v":1}}')
  })

  it('copies a shared reference held in two array items', () => {
    const shared = { v: 1 }
    expect(selectiveCopy([shared, shared]).clone).toEqual([{ v: 1 }, { v: 1 }])
  })

  it('still recreates a cycle that sits behind a shared reference', () => {
    const shared: Record<string, unknown> = { v: 1 }
    shared['self'] = shared
    const clone = selectiveCopy({ a: shared, b: shared }).clone
    expect(clone.b['self']).toBe(clone.b)
  })
})

describe('selectiveCopy - with non-extensible input', () => {
  beforeEach(() => setConfig({ detectCircularReferences: true }))

  afterEach(() => setConfig({ detectCircularReferences: false }))

  it('clones a frozen value', () => {
    expect(selectiveCopy(Object.freeze({ a: Object.freeze({ b: 1 }) })).clone).toEqual({ a: { b: 1 } })
  })

  it('clones a sealed value', () => {
    expect(selectiveCopy(Object.seal({ a: 1 })).clone).toEqual({ a: 1 })
  })

  it('recreates the cycle of a frozen value that contains itself', () => {
    const target: Record<string, unknown> = { a: 1 }
    target['self'] = target
    Object.freeze(target)
    const clone = selectiveCopy(target).clone
    expect(clone['self']).toBe(clone)
  })
})

describe('selectiveCopy - __proto__ pollution prevention (non-circular)', () => {
  beforeEach(() => setConfig({ detectCircularReferences: false }))

  afterEach(() => {
    setConfig({ detectCircularReferences: false })
    // lint-disable-next-line typescript/no-explicit-any
    delete (Object.prototype as any).polluted
    // lint-disable-next-line typescript/no-explicit-any
    delete (Object.prototype as any).value
  })

  it('leaves the __proto__ key out of the clone during basic copy', () => {
    const malicious: Record<string, unknown> = { safe: 'value' }
    Object.defineProperty(malicious, '__proto__', {
      value: { polluted: true },
      enumerable: true,
      configurable: true,
    })
    const { clone } = selectiveCopy(malicious)
    expect({ clone, keys: Object.keys(clone) }).toEqual({ clone: { safe: 'value' }, keys: ['safe'] })
  })

  it('prevents __proto__ pollution during basic copy', () => {
    const malicious: Record<string, unknown> = { safe: 'value' }
    Object.defineProperty(malicious, '__proto__', {
      value: { polluted: true },
      enumerable: true,
      configurable: true,
    })
    selectiveCopy(malicious)
    expect(Object.prototype).not.toHaveProperty('polluted')
  })

  it('leaves the __proto__ key of a nested object out of the clone', () => {
    const nested: Record<string, unknown> = { alsoSafe: 42 }
    Object.defineProperty(nested, '__proto__', {
      value: { polluted: true },
      enumerable: true,
      configurable: true,
    })
    const target = { safe: 'value', nested }
    const { clone } = selectiveCopy(target)
    expect({ clone, nestedKeys: Object.keys((clone as Record<string, unknown>)['nested'] as object) }).toEqual({
      clone: { safe: 'value', nested: { alsoSafe: 42 } },
      nestedKeys: ['alsoSafe'],
    })
  })

  it('prevents __proto__ pollution when copying a nested object with a __proto__ key', () => {
    const nested: Record<string, unknown> = { alsoSafe: 42 }
    Object.defineProperty(nested, '__proto__', {
      value: { polluted: true },
      enumerable: true,
      configurable: true,
    })
    const target = { safe: 'value', nested }
    selectiveCopy(target)
    expect(Object.prototype).not.toHaveProperty('polluted')
  })

  it('copies the items of an array with __proto__ property', () => {
    const arr = ['a', 'b', 'c']
    Object.defineProperty(arr, '__proto__', {
      value: { polluted: true },
      enumerable: true,
      configurable: true,
    })
    const { clone } = selectiveCopy(arr)
    expect(clone).toEqual(['a', 'b', 'c'])
  })

  it('prevents __proto__ pollution when copying an array with a __proto__ property', () => {
    const arr = ['a', 'b', 'c']
    Object.defineProperty(arr, '__proto__', {
      value: { polluted: true },
      enumerable: true,
      configurable: true,
    })
    selectiveCopy(arr)
    expect(Object.prototype).not.toHaveProperty('polluted')
  })
})

describe('selectiveCopy - __proto__ pollution prevention (circular references)', () => {
  beforeEach(() => setConfig({ detectCircularReferences: true }))

  afterEach(() => {
    setConfig({ detectCircularReferences: false })
    // lint-disable-next-line typescript/no-explicit-any
    delete (Object.prototype as any).polluted
    // lint-disable-next-line typescript/no-explicit-any
    delete (Object.prototype as any).value
    // lint-disable-next-line typescript/no-explicit-any
    delete (Object.prototype as any).traversal
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
    expect({ inner: clone['inner'], innerKeys: Object.keys(clone['inner'] as Record<string, unknown>) }).toEqual({
      inner: { value: 'inner' },
      innerKeys: ['value'],
    })
    // lint-disable-next-line typescript/no-explicit-any
    delete (inner as any).__proto__
  })

  it('keeps the circular path when __proto__ appears in startPath during circular ref resolution', () => {
    const target: Record<string, unknown> = { a: { b: {} } }
    ;(target['a'] as Record<string, unknown>)['b'] = target['a']
    Object.defineProperty(target, '__proto__', {
      value: { polluted: 'bad' },
      enumerable: true,
      configurable: true,
    })
    const { clone } = selectiveCopy(target)
    expect(clone).toHaveProperty(['a', 'b'])
  })

  it('prevents pollution when __proto__ appears in startPath during circular ref resolution', () => {
    const target: Record<string, unknown> = { a: { b: {} } }
    ;(target['a'] as Record<string, unknown>)['b'] = target['a']
    Object.defineProperty(target, '__proto__', {
      value: { polluted: 'bad' },
      enumerable: true,
      configurable: true,
    })
    selectiveCopy(target)
    expect(Object.prototype).not.toHaveProperty('polluted')
  })

  it.each([['self'], ['safe']])(
    'keeps the %s property of the nested value when __proto__ appears in destinationPath during circular ref resolution',
    (key: string) => {
      const inner: Record<string, unknown> = { safe: 'value' }
      const target: Record<string, unknown> = { inner }
      inner['self'] = inner
      Object.defineProperty(target, '__proto__', {
        value: { polluted: 'bad' },
        enumerable: true,
        configurable: true,
      })
      const { clone } = selectiveCopy(target)
      expect(clone).toHaveProperty(['inner', key])
    }
  )

  it('prevents pollution when __proto__ appears in destinationPath during circular ref resolution', () => {
    const inner: Record<string, unknown> = { safe: 'value' }
    const target: Record<string, unknown> = { inner }
    inner['self'] = inner
    Object.defineProperty(target, '__proto__', {
      value: { polluted: 'bad' },
      enumerable: true,
      configurable: true,
    })
    selectiveCopy(target)
    expect(Object.prototype).not.toHaveProperty('polluted')
  })

  it('keeps the path to the cycle during path traversal in circular ref resolution', () => {
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
    expect(clone).toHaveProperty(['level1', 'level2'])
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
    selectiveCopy(target)
    expect(Object.prototype).not.toHaveProperty('polluted')
  })
})
