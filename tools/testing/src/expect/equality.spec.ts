import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createAsymmetric } from './asymmetric'
import { equals, matchesSubset } from './equality'

describe('equals in structural mode', () => {
  it('treats a missing key and an undefined key as the same', () => {
    assert.equal(equals({ a: 1, b: undefined }, { a: 1 }), true)
  })

  it('ignores the prototype so a class instance equals a plain object', () => {
    class Point {
      x = 1
    }
    assert.equal(equals(new Point(), { x: 1 }), true)
  })

  it('separates NaN from a number', () => {
    assert.equal(equals(NaN, 0), false)
  })

  it('treats NaN as equal to itself', () => {
    assert.equal(equals(NaN, NaN), true)
  })

  it('treats positive and negative zero as equal', () => {
    assert.equal(equals(0, -0), true)
  })

  it('compares dates by instant', () => {
    assert.equal(equals(new Date(5), new Date(5)), true)
  })

  it('separates a date from a non-date', () => {
    assert.equal(equals(new Date(5), { getTime: () => 5 }), false)
  })

  it('compares regular expressions by source and flags', () => {
    assert.equal(equals(/a/gi, /a/gi), true)
  })

  it('separates regular expressions differing only in flags', () => {
    assert.equal(equals(/a/g, /a/i), false)
  })

  it('compares errors by name and message', () => {
    assert.equal(equals(new TypeError('boom'), new TypeError('boom')), true)
  })

  it('separates errors of different types', () => {
    assert.equal(equals(new TypeError('boom'), new RangeError('boom')), false)
  })

  it('separates an array from an object with numeric keys', () => {
    assert.equal(equals([1], { 0: 1 }), false)
  })

  it('compares maps whose keys are structurally but not referentially equal', () => {
    assert.equal(equals(new Map([[{ id: 1 }, 'a']]), new Map([[{ id: 1 }, 'a']])), true)
  })

  it('compares maps by a shared primitive key', () => {
    assert.equal(equals(new Map([['a', { id: 1 }]]), new Map([['a', { id: 1 }]])), true)
  })

  it('separates maps whose object keys do not correspond', () => {
    assert.equal(equals(new Map([[{ id: 1 }, 'a']]), new Map([[{ id: 2 }, 'a']])), false)
  })

  it('separates maps sharing a key but not its value', () => {
    assert.equal(equals(new Map([['a', 1]]), new Map([['a', 2]])), false)
  })

  it('separates maps of differing size', () => {
    assert.equal(
      equals(
        new Map([['a', 1]]),
        new Map([
          ['a', 1],
          ['b', 2],
        ])
      ),
      false
    )
  })

  it('compares sets whose members are structurally but not referentially equal', () => {
    assert.equal(equals(new Set([{ id: 1 }]), new Set([{ id: 1 }])), true)
  })

  it('separates sets with a differing member', () => {
    assert.equal(equals(new Set([1]), new Set([2])), false)
  })

  it('compares typed arrays element by element', () => {
    assert.equal(equals(new Uint8Array([1, 2]), new Uint8Array([1, 2])), true)
  })

  it('separates typed arrays of different kinds', () => {
    assert.equal(equals(new Uint8Array([1]), new Int8Array([1])), false)
  })

  it('compares enumerable symbol keys', () => {
    const key = Symbol('shared')
    assert.equal(equals({ [key]: 1 }, { [key]: 2 }), false)
  })

  it('defers to an asymmetric matcher on the expected side', () => {
    assert.equal(
      equals(
        42,
        createAsymmetric('even', (value) => (value as number) % 2 === 0)
      ),
      true
    )
  })

  it('defers to an asymmetric matcher on the received side', () => {
    assert.equal(
      equals(
        createAsymmetric('even', (value) => (value as number) % 2 === 0),
        42
      ),
      true
    )
  })

  it('separates objects with a differing key count', () => {
    assert.equal(equals({ a: 1 }, { a: 1, b: 2 }), false)
  })

  it('separates objects whose keys do not overlap', () => {
    assert.equal(equals({ a: 1 }, { b: 1 }), false)
  })

  it('recurses into nested values', () => {
    assert.equal(equals({ a: { b: [1, { c: 2 }] } }, { a: { b: [1, { c: 2 }] } }), true)
  })

  it('separates a null from an object', () => {
    assert.equal(equals(null, {}), false)
  })

  it('separates a primitive from an object', () => {
    assert.equal(equals('a', {}), false)
  })
})

describe('equals in strict mode', () => {
  it('separates a missing key from an undefined key', () => {
    assert.equal(equals({ a: 1, b: undefined }, { a: 1 }, 'strict'), false)
  })

  it('separates a class instance from a plain object', () => {
    class Point {
      x = 1
    }
    assert.equal(equals(new Point(), { x: 1 }, 'strict'), false)
  })
})

describe('matchesSubset', () => {
  it('accepts an object carrying more keys than expected', () => {
    assert.equal(matchesSubset({ a: 1, b: 2 }, { a: 1 }), true)
  })

  it('rejects an object missing an expected key', () => {
    assert.equal(matchesSubset({ a: 1 }, { b: 1 }), false)
  })

  it('requires arrays to match in length', () => {
    assert.equal(matchesSubset([1, 2], [1]), false)
  })

  it('recurses into array elements', () => {
    assert.equal(matchesSubset([{ a: 1, b: 2 }], [{ a: 1 }]), true)
  })

  it('rejects a non-object where an object subset was expected', () => {
    assert.equal(matchesSubset('nope', { a: 1 }), false)
  })

  it('rejects a non-array where an array was expected', () => {
    assert.equal(matchesSubset('nope', [1]), false)
  })

  it('defers to an asymmetric matcher', () => {
    assert.equal(matchesSubset({ a: 2 }, { a: createAsymmetric('even', (value) => (value as number) % 2 === 0) }), true)
  })

  it('compares dates by value rather than by property', () => {
    assert.equal(matchesSubset({ at: new Date(5) }, { at: new Date(5) }), true)
  })
})
