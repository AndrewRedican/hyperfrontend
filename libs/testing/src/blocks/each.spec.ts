import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatTitle, rowArguments } from './each'

describe('rowArguments', () => {
  it('spreads an array row across parameters', () => {
    assert.deepEqual(rowArguments([1, 2]), [1, 2])
  })

  it('wraps a primitive row as a single argument', () => {
    assert.deepEqual(rowArguments(5), [5])
  })

  it('wraps an object row as a single argument', () => {
    assert.deepEqual(rowArguments({ a: 1 }), [{ a: 1 }])
  })
})

describe('formatTitle', () => {
  it('appends a single argument when the title has no placeholder', () => {
    assert.equal(formatTitle('rejects the port', [8080], 0), 'rejects the port 8080')
  })

  it('appends the whole row when the title has no placeholder', () => {
    assert.equal(formatTitle('pairs', ['a', 1], 0), "pairs [ 'a', 1 ]")
  })

  it('substitutes a string placeholder', () => {
    assert.equal(formatTitle('treats %s as compressible', ['/big.json'], 0), 'treats /big.json as compressible')
  })

  it('substitutes a pretty placeholder', () => {
    assert.equal(formatTitle('rejects the port %p', ['8080'], 0), "rejects the port '8080'")
  })

  it('substitutes a number placeholder', () => {
    assert.equal(formatTitle('accepts %d', [42], 0), 'accepts 42')
  })

  it('substitutes the row index', () => {
    assert.equal(formatTitle('case %#', ['x'], 3), 'case 3')
  })

  it('keeps each placeholder aligned with its own argument when kinds are mixed', () => {
    assert.equal(formatTitle('%s then %p', ['a', 'b'], 0), "a then 'b'")
  })

  it('renders an escaped percent literally', () => {
    assert.equal(formatTitle('100%% of %s', ['cases'], 0), '100% of cases')
  })

  it('leaves a placeholder untouched when the row runs out of arguments', () => {
    assert.equal(formatTitle('%s and %s', ['only'], 0), 'only and %s')
  })
})
