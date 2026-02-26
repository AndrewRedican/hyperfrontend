/**
 * CJS (CommonJS) E2E tests for @hyperfrontend/data-utils
 * Tests that the package is requireable and exports work correctly.
 */

describe('@hyperfrontend/data-utils CJS', () => {
  it('should be requireable', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dataUtils = require('@hyperfrontend/data-utils')
    expect(dataUtils).toBeDefined()
  })

  it('should export getType function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getType } = require('@hyperfrontend/data-utils')
    expect(typeof getType).toBe('function')
  })

  it('should correctly detect types', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getType } = require('@hyperfrontend/data-utils')

    expect(getType('hello')).toBe('string')
    expect(getType(123)).toBe('number')
    expect(getType(true)).toBe('boolean')
    expect(getType(null)).toBe('null')
    expect(getType(undefined)).toBe('undefined')
    expect(getType([])).toBe('array')
    expect(getType({})).toBe('object')
  })

  it('should export isIdentical function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isIdentical } = require('@hyperfrontend/data-utils')
    expect(typeof isIdentical).toBe('function')
  })

  it('should detect identical values', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isIdentical } = require('@hyperfrontend/data-utils')

    expect(isIdentical({ a: 1 }, { a: 1 })).toBe(true)
    expect(isIdentical({ a: 1 }, { a: 2 })).toBe(false)
    expect(isIdentical([1, 2, 3], [1, 2, 3])).toBe(true)
  })

  it('should export sameType function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { sameType } = require('@hyperfrontend/data-utils')
    expect(typeof sameType).toBe('function')

    expect(sameType('hello', 'world')).toBe('string')
    expect(sameType('hello', 123)).toBe(false)
  })

  it('should export traverse function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { traverse } = require('@hyperfrontend/data-utils')
    expect(typeof traverse).toBe('function')
  })

  it('should export selectiveCopy function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { selectiveCopy } = require('@hyperfrontend/data-utils')
    expect(typeof selectiveCopy).toBe('function')
  })

  it('should export hasCircularReference function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { hasCircularReference } = require('@hyperfrontend/data-utils')
    expect(typeof hasCircularReference).toBe('function')

    const obj: Record<string, unknown> = { a: 1 }
    expect(hasCircularReference(obj)).toBe(false)

    obj.self = obj
    expect(hasCircularReference(obj)).toBe(true)
  })

  it('should export getDepth function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getDepth } = require('@hyperfrontend/data-utils')
    expect(typeof getDepth).toBe('function')
  })

  it('should export locateKey function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { locateKey } = require('@hyperfrontend/data-utils')
    expect(typeof locateKey).toBe('function')
  })
})
