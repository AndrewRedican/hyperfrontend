/**
 * CJS (CommonJS) E2E tests for @hyperfrontend/immutable-api-utils
 * Tests that the package is requireable and exports work correctly.
 */

describe('@hyperfrontend/immutable-api-utils CJS', () => {
  it('should be requireable', () => {
    const immutableApiUtils = require('@hyperfrontend/immutable-api-utils')
    expect(immutableApiUtils).toBeDefined()
  })

  it('should export lockedPropertyDescriptors', () => {
    const { lockedPropertyDescriptors } = require('@hyperfrontend/immutable-api-utils')
    expect(typeof lockedPropertyDescriptors).toBe('function')
  })

  it('should create locked property descriptors', () => {
    const { lockedPropertyDescriptors } = require('@hyperfrontend/immutable-api-utils')

    const descriptor = lockedPropertyDescriptors('test-value')
    expect(descriptor).toEqual({
      value: 'test-value',
      writable: false,
      configurable: false,
      enumerable: false,
    })
  })

  it('should export lockedProps', () => {
    const { lockedProps } = require('@hyperfrontend/immutable-api-utils')
    expect(typeof lockedProps).toBe('function')
  })

  it('should lock properties on an object', () => {
    const { lockedProps } = require('@hyperfrontend/immutable-api-utils')

    const obj: Record<string, unknown> = {}
    lockedProps(obj, [
      ['foo', 'bar'],
      ['num', 42],
    ])

    expect(obj.foo).toBe('bar')
    expect(obj.num).toBe(42)

    // Should not be writable
    expect(() => {
      obj.foo = 'changed'
    }).toThrow()
  })

  it('should export locked decorator', () => {
    const { locked } = require('@hyperfrontend/immutable-api-utils')
    expect(typeof locked).toBe('function')
  })
})
