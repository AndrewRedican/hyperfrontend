import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { inspect } from 'node:util'
import { createAsymmetric, isAsymmetric, matchesConstructor } from './asymmetric'

describe('isAsymmetric', () => {
  it('recognises a matcher', () => {
    assert.equal(isAsymmetric(createAsymmetric('any', () => true)), true)
  })

  it('rejects a plain object', () => {
    assert.equal(isAsymmetric({}), false)
  })

  it('rejects null', () => {
    assert.equal(isAsymmetric(null), false)
  })

  it('rejects a primitive', () => {
    assert.equal(isAsymmetric('matcher'), false)
  })
})

describe('createAsymmetric', () => {
  it('reports its label when stringified', () => {
    assert.equal(String(createAsymmetric('Anything', () => true)), 'Anything')
  })

  it('reports its label when inspected', () => {
    assert.equal(inspect(createAsymmetric('Anything', () => true)), 'Anything')
  })

  it('delegates the verdict to the predicate', () => {
    assert.equal(createAsymmetric('even', (value) => (value as number) % 2 === 0).asymmetricMatch(3), false)
  })
})

describe('matchesConstructor', () => {
  const CASES: [string, unknown, unknown, boolean][] = [
    ['a string primitive against String', 'a', String, true],
    ['a boxed string against String', new String('a'), String, true],
    ['a number against String', 1, String, false],
    ['a number primitive against Number', 1, Number, true],
    ['a boxed number against Number', new Number(1), Number, true],
    ['a boolean against Boolean', true, Boolean, true],
    ['a boxed boolean against Boolean', new Boolean(true), Boolean, true],
    ['a bigint against BigInt', 1n, BigInt, true],
    ['a number against BigInt', 1, BigInt, false],
    ['a symbol against Symbol', Symbol('s'), Symbol, true],
    ['a string against Symbol', 's', Symbol, false],
    ['a function against Function', () => undefined, Function, true],
    ['an object against Object', {}, Object, true],
    ['null against Object', null, Object, false],
    ['an instance against its class', new TypeError('x'), TypeError, true],
    ['an instance against an unrelated class', new TypeError('x'), RangeError, false],
    ['a value against a non-constructor', 1, 'not a constructor', false],
  ]

  for (const [title, received, constructor, expected] of CASES) {
    it(`${expected ? 'matches' : 'rejects'} ${title}`, () => {
      assert.equal(matchesConstructor(received, constructor), expected)
    })
  }
})
