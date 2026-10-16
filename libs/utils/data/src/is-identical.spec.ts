/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-empty-function */
import type { Config } from './models'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { deregisterIterableClass } from './deregister-iterable-class'
import { isIdentical } from './is-identical'
import { registerIterableClass } from './register-iterable-class'
import { setConfig } from './shared/consts'

const configReset: Config = Object.freeze({
  samePositionOfOwnProperties: false,
  detectCircularReferences: false,
})

describe('isIdentical', () => {
  beforeEach(() => setConfig(configReset))

  it.each([
    [25, 25],
    [null, null],
    [undefined, void 0],
    ['hello world', 'hello world'],
  ])('returns true when strict check quality check is true: %p and %p', (left: unknown, right: unknown) => {
    expect(isIdentical(left, right)).toEqual(true)
  })

  it('returns true when strict check quality check is true for an array reference', () => {
    const array: unknown[] = []
    expect(isIdentical(array, array)).toEqual(true)
  })

  it('returns true when strict check quality check is true for an object reference', () => {
    const object = {}
    expect(isIdentical(object, object)).toEqual(true)
  })

  it.each([
    [{}, {}],
    [[], []],
  ])('returns true for empty iterables of the same type: %p and %p', (left: unknown, right: unknown) => {
    expect(isIdentical(left, right)).toEqual(true)
  })

  it.each([
    [{ a: 1 }, { a: 1 }],
    [['banana'], ['banana']],
  ])('returns true when complex types have same key value pairs: %p and %p', (left: unknown, right: unknown) => {
    expect(isIdentical(left, right)).toEqual(true)
  })

  it('returns true for non-indexed iterables whose keys match, but are in wrong order', () => {
    expect(isIdentical({ a: 1, b: '2' }, { b: '2', a: 1 })).toEqual(true)
  })

  it.each([
    ['anonymous function expressions', function () {}, function () {}],
    ['arrow functions', () => {}, () => {}],
    ['named function expressions with a rest parameter', function A(...args: unknown[]) {}, function A(...args: unknown[]) {}],
    ['arrow functions with a parameter', (_: unknown) => void 0, (_: unknown) => void 0],
  ])(
    'returns true for functions that have the exact same declaration, arguments, and content: %s',
    (_label: string, left: unknown, right: unknown) => {
      expect(isIdentical(left, right)).toEqual(true)
    }
  )

  it('returns false for functions with different content', () => {
    expect(
      isIdentical(
        function () {
          void 0
        },
        function () {}
      )
    ).toEqual(false)
  })

  it('returns false for functions with different declaration/assignment: a function expression and an arrow function', () => {
    expect(
      isIdentical(
        function () {},
        () => {}
      )
    ).toEqual(false)
  })

  it('returns false for functions with different declaration/assignment: an arrow function and a function expression of the same name', () => {
    const funcA = () => {}
    expect(isIdentical(funcA, function funcA() {})).toEqual(false)
  })

  it.each([
    [
      [1, 2, 3],
      [3, 1, 2],
    ],
    [
      [4, 1, 2],
      [3, 2, 4],
    ],
  ])('returns false for lists with items in the wrong order: %p and %p', (left: unknown, right: unknown) => {
    expect(isIdentical(left, right)).toEqual(false)
  })

  it.each([
    [Symbol(), Symbol()],
    ['', []],
    [[], {}],
    [-23, 23],
    [undefined, null],
  ])('returns false for values that do not match: %p and %p', (left: unknown, right: unknown) => {
    expect(isIdentical(left, right)).toEqual(false)
  })

  it('throws an error when given values with circular references and detection is OFF', () => {
    const [selfReferencingObjectA, selfReferencingObjectB] = [{ a: {} }, { a: {} }]
    selfReferencingObjectA.a = selfReferencingObjectA
    selfReferencingObjectB.a = selfReferencingObjectB
    expect(() => isIdentical(selfReferencingObjectA, selfReferencingObjectB)).toThrow()
  })

  it('returns true when when given values with circular references that point to the same object in memory', () => {
    const selfReferencingObjectA = { a: {} }
    selfReferencingObjectA.a = selfReferencingObjectA
    expect(isIdentical(selfReferencingObjectA, selfReferencingObjectA)).toEqual(true)
  })
})

describe('isIdentical - with config samePositionOfOwnProperties: true', () => {
  beforeEach(() => setConfig({ samePositionOfOwnProperties: true }))

  afterEach(() => setConfig(configReset))

  it('returns false for non-indexed iterables whose keys match, but are in wrong order', () => {
    expect(isIdentical({ a: 1, b: '2' }, { b: '2', a: 1 })).toEqual(false)
  })
})

describe('isIdentical - with config detectCircularReferences:true', () => {
  beforeEach(() =>
    setConfig({
      detectCircularReferences: true,
      samePositionOfOwnProperties: false,
    })
  )

  afterEach(() => setConfig(configReset))

  it.each([
    [25, 25],
    [null, null],
    [undefined, void 0],
    ['hello world', 'hello world'],
  ])('returns true when strict check quality check is true: %p and %p', (left: unknown, right: unknown) => {
    expect(isIdentical(left, right)).toEqual(true)
  })

  it('returns true when strict check quality check is true for an array reference', () => {
    const array: unknown[] = []
    expect(isIdentical(array, array)).toEqual(true)
  })

  it('returns true when strict check quality check is true for an object reference', () => {
    const object = {}
    expect(isIdentical(object, object)).toEqual(true)
  })

  it.each([
    [{}, {}],
    [[], []],
  ])('returns true for empty iterables of the same type: %p and %p', (left: unknown, right: unknown) => {
    expect(isIdentical(left, right)).toEqual(true)
  })

  it.each([
    [{ a: 1 }, { a: 1 }],
    [['banana'], ['banana']],
  ])('returns true when complex types have same key value pairs: %p and %p', (left: unknown, right: unknown) => {
    expect(isIdentical(left, right)).toEqual(true)
  })

  it('returns true for non-indexed iterables whose keys match, but are in wrong order', () => {
    expect(isIdentical({ a: 1, b: '2' }, { b: '2', a: 1 })).toEqual(true)
  })

  it.each([
    ['anonymous function expressions', function () {}, function () {}],
    ['arrow functions', () => {}, () => {}],
    ['named function expressions with a rest parameter', function A(...args: unknown[]) {}, function A(...args: unknown[]) {}],
    ['arrow functions with a parameter', (_: unknown) => void 0, (_: unknown) => void 0],
  ])(
    'returns true for functions that have the exact same declaration, arguments, and content: %s',
    (_label: string, left: unknown, right: unknown) => {
      expect(isIdentical(left, right)).toEqual(true)
    }
  )

  it('returns false for functions with different content', () => {
    expect(
      isIdentical(
        function () {
          void 0
        },
        function () {}
      )
    ).toEqual(false)
  })

  it('returns false for functions with different declaration/assignment: a function expression and an arrow function', () => {
    expect(
      isIdentical(
        function () {},
        () => {}
      )
    ).toEqual(false)
  })

  it('returns false for functions with different declaration/assignment: an arrow function and a function expression of the same name', () => {
    const funcA = () => {}
    expect(isIdentical(funcA, function funcA() {})).toEqual(false)
  })

  it.each([
    [
      [1, 2, 3],
      [3, 1, 2],
    ],
    [
      [4, 1, 2],
      [3, 2, 4],
    ],
  ])('returns false for lists with items in the wrong order: %p and %p', (left: unknown, right: unknown) => {
    expect(isIdentical(left, right)).toEqual(false)
  })

  it.each([
    [Symbol(), Symbol()],
    ['', []],
    [[], {}],
    [-23, 23],
    [undefined, null],
  ])('returns false for values that do not match: %p and %p', (left: unknown, right: unknown) => {
    expect(isIdentical(left, right)).toEqual(false)
  })

  it('returns true when given values with the exact same circular references', () => {
    const [selfReferencingObjectA, selfReferencingObjectB] = [{ a: {} }, { a: {} }]
    selfReferencingObjectA.a = selfReferencingObjectA
    selfReferencingObjectB.a = selfReferencingObjectB
    expect(isIdentical(selfReferencingObjectA, selfReferencingObjectB)).toEqual(true)
  })

  it('returns false when given values with the different same circular references: back to the root against back to the parent', () => {
    const [selfReferencingObjectA, selfReferencingObjectB] = [{ a: { b: { c: {} } } }, { a: { b: { c: {} } } }]
    selfReferencingObjectA.a.b.c = selfReferencingObjectA
    selfReferencingObjectB.a.b.c = selfReferencingObjectB.a.b
    expect(isIdentical(selfReferencingObjectA, selfReferencingObjectB)).toEqual(false)
  })

  it('returns false when given values with the different same circular references: back to the root from different depths', () => {
    const [selfReferencingObjectC, selfReferencingObjectD] = [{ a: { b: { c: { d: {} } } } }, { a: { b: {} } }]
    selfReferencingObjectC.a.b.c.d = selfReferencingObjectC
    selfReferencingObjectD.a.b = selfReferencingObjectD
    expect(isIdentical(selfReferencingObjectC, selfReferencingObjectD)).toEqual(false)
  })

  it('returns false when given values with the different same circular references: back to the root against back to a nested value', () => {
    const [selfReferencingObjectE, selfReferencingObjectF] = [{ a: { b: { c: { d: {} } } } }, { a: { b: {} } }]
    selfReferencingObjectE.a.b.c.d = selfReferencingObjectE
    selfReferencingObjectF.a.b = { c: { d: selfReferencingObjectF.a } }
    expect(isIdentical(selfReferencingObjectE, selfReferencingObjectF)).toEqual(false)
  })

  it('returns true when given mutually referencing values whose circular references mirror each other exactly', () => {
    const [selfReferencingObjectG, selfReferencingObjectH] = [{ a: { b: {} } }, { a: { b: {} } }]
    selfReferencingObjectG.a.b = selfReferencingObjectH
    selfReferencingObjectH.a.b = selfReferencingObjectG
    expect(isIdentical(selfReferencingObjectG, selfReferencingObjectH)).toEqual(true)
  })

  it('returns false when given mutually referencing values whose circular references mirror do not each other exactly', () => {
    const [selfReferencingObjectG, selfReferencingObjectH] = [{ a: { b: {} } }, { a: { b: {} } }]
    selfReferencingObjectG.a.b = selfReferencingObjectH
    selfReferencingObjectH.a.b = selfReferencingObjectG.a
    expect(isIdentical(selfReferencingObjectG, selfReferencingObjectH)).toEqual(false)
  })
})

describe('isIdentical - with references shared between branches', () => {
  beforeEach(() => setConfig({ detectCircularReferences: true }))

  afterEach(() => setConfig(configReset))

  it('returns true when a shared reference is compared against two equal objects', () => {
    const shared = { v: 1 }
    expect(isIdentical({ a: shared, b: shared }, { a: { v: 1 }, b: { v: 1 } })).toEqual(true)
  })

  it('returns the same verdict as a comparison with detection off', () => {
    const shared = { v: 1 }
    setConfig(configReset)
    const withDetectionOff = isIdentical({ a: shared, b: shared }, { a: { v: 1 }, b: { v: 1 } })
    setConfig({ detectCircularReferences: true })
    expect(isIdentical({ a: shared, b: shared }, { a: { v: 1 }, b: { v: 1 } })).toEqual(withDetectionOff)
  })

  it('returns false when only one side shares a reference between differing branches', () => {
    const shared = { v: 1 }
    expect(isIdentical({ a: shared, b: shared }, { a: { v: 1 }, b: { v: 2 } })).toEqual(false)
  })

  it('returns true when both sides share a reference between two array items', () => {
    const [sharedA, sharedB] = [{ v: 1 }, { v: 1 }]
    expect(isIdentical([sharedA, sharedA], [sharedB, sharedB])).toEqual(true)
  })
})

describe('isIdentical - with non-extensible input', () => {
  beforeEach(() => setConfig({ detectCircularReferences: true }))

  afterEach(() => setConfig(configReset))

  it('returns true for two frozen values with the same content', () => {
    expect(isIdentical(Object.freeze({ a: Object.freeze({ b: 1 }) }), Object.freeze({ a: Object.freeze({ b: 1 }) }))).toEqual(true)
  })

  it('returns false for two frozen values with different content', () => {
    expect(isIdentical(Object.freeze({ a: 1 }), Object.freeze({ a: 2 }))).toEqual(false)
  })

  it('returns true for two sealed values with the same content', () => {
    expect(isIdentical(Object.seal({ a: 1 }), Object.seal({ a: 1 }))).toEqual(true)
  })

  it('returns true for two frozen values with the same self-reference', () => {
    const [targetA, targetB] = [{ a: {} }, { a: {} }]
    targetA.a = targetA
    targetB.a = targetB
    expect(isIdentical(Object.freeze(targetA), Object.freeze(targetB))).toEqual(true)
  })
})

describe('isIdentical - with config detectCircularReferences:true, samePositionOfOwnProperties: true', () => {
  beforeEach(() =>
    setConfig({
      detectCircularReferences: true,
      samePositionOfOwnProperties: true,
    })
  )

  afterEach(() => setConfig(configReset))

  it('returns false for non-indexed iterables whose keys match, but are in wrong order', () => {
    expect(isIdentical({ a: 1, b: '2' }, { b: '2', a: 1 })).toEqual(false)
  })
})

describe('isIdentical - with extended iterable class types', () => {
  beforeEach(() => {
    registerIterableClass<Map<unknown, unknown>>(
      Map,
      (map) => Array.from(map.keys()) as string[],
      (map, key) => map.get(key),
      (map, value, key) => map.set(key, value),
      (map, key) => map.delete(key)
    )
    registerIterableClass<Set<unknown>>(
      Set,
      (set) => Array.from(set.keys()) as string[],
      (_, key) => key,
      (set, value) => set.add(value),
      (set, key) => set.delete(key)
    )
  })

  afterEach(() => deregisterIterableClass())

  it('returns true for custom iterables of the same type and content', () => {
    const map = new Map<string, number>()
    const map2 = new Map<string, number>()
    map.set('emerald', 65)
    map2.set('emerald', 65)
    expect(isIdentical(map, map2)).toEqual(true)
  })

  it('returns false for custom iterables of the same type but different value', () => {
    const map = new Map<string, number>()
    const map2 = new Map<string, number>()
    map.set('emerald', 65)
    map2.set('ruby', 54)
    expect(isIdentical(map, map2)).toEqual(false)
  })

  it('returns false for custom iterables of a different type', () => {
    const map = new Map<string, number>()
    const set = new Set<string>()
    map.set('emerald', 65)
    set.add('ruby')
    expect(isIdentical(map, set)).toEqual(false)
  })
})
