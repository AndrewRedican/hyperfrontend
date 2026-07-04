/**
 * CJS (CommonJS) E2E tests for @hyperfrontend/data-utils
 * Tests that the package is requireable and exports work correctly.
 */

describe('@hyperfrontend/data-utils CJS', () => {
  it('is requireable', () => {
    const dataUtils = require('@hyperfrontend/data-utils')
    expect(dataUtils).toBeDefined()
  })

  it('exports getType function', () => {
    const { getType } = require('@hyperfrontend/data-utils')
    expect(typeof getType).toBe('function')
  })

  it('correctly detects types', () => {
    const { getType } = require('@hyperfrontend/data-utils')

    expect(getType('hello')).toBe('string')
    expect(getType(123)).toBe('number')
    expect(getType(true)).toBe('boolean')
    expect(getType(null)).toBe('null')
    expect(getType(undefined)).toBe('undefined')
    expect(getType([])).toBe('array')
    expect(getType({})).toBe('object')
  })

  it('exports isIdentical function', () => {
    const { isIdentical } = require('@hyperfrontend/data-utils')
    expect(typeof isIdentical).toBe('function')
  })

  it('detects identical values', () => {
    const { isIdentical } = require('@hyperfrontend/data-utils')

    expect(isIdentical({ a: 1 }, { a: 1 })).toBe(true)
    expect(isIdentical({ a: 1 }, { a: 2 })).toBe(false)
    expect(isIdentical([1, 2, 3], [1, 2, 3])).toBe(true)
  })

  it('exports sameType function', () => {
    const { sameType } = require('@hyperfrontend/data-utils')
    expect(typeof sameType).toBe('function')

    expect(sameType('hello', 'world')).toBe('string')
    expect(sameType('hello', 123)).toBe(false)
  })

  it('exports traverse function', () => {
    const { traverse } = require('@hyperfrontend/data-utils')
    expect(typeof traverse).toBe('function')
  })

  it('exports selectiveCopy function', () => {
    const { selectiveCopy } = require('@hyperfrontend/data-utils')
    expect(typeof selectiveCopy).toBe('function')
  })

  it('exports hasCircularReference function', () => {
    const { hasCircularReference } = require('@hyperfrontend/data-utils')
    expect(typeof hasCircularReference).toBe('function')

    const obj: Record<string, unknown> = { a: 1 }
    expect(hasCircularReference(obj)).toBe(false)

    obj.self = obj
    expect(hasCircularReference(obj)).toBe(true)
  })

  it('exports getDepth function', () => {
    const { getDepth } = require('@hyperfrontend/data-utils')
    expect(typeof getDepth).toBe('function')
  })

  it('exports locateKey function', () => {
    const { locateKey } = require('@hyperfrontend/data-utils')
    expect(typeof locateKey).toBe('function')
  })
})
