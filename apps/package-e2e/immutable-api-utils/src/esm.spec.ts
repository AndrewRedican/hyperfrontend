/**
 * ESM (ES Modules) E2E tests for @hyperfrontend/immutable-api-utils
 * Tests that the package is importable and exports work correctly.
 */

describe('@hyperfrontend/immutable-api-utils ESM', () => {
  it('should be importable', async () => {
    const immutableApiUtils = await import('@hyperfrontend/immutable-api-utils')
    expect(immutableApiUtils).toBeDefined()
  })

  it('should export lockedPropertyDescriptors', async () => {
    const { lockedPropertyDescriptors } = await import('@hyperfrontend/immutable-api-utils')
    expect(typeof lockedPropertyDescriptors).toBe('function')
  })

  it('should create locked property descriptors', async () => {
    const { lockedPropertyDescriptors } = await import('@hyperfrontend/immutable-api-utils')

    const descriptor = lockedPropertyDescriptors('test-value')
    expect(descriptor).toEqual({
      value: 'test-value',
      writable: false,
      configurable: false,
      enumerable: false,
    })
  })

  it('should export lockedProps', async () => {
    const { lockedProps } = await import('@hyperfrontend/immutable-api-utils')
    expect(typeof lockedProps).toBe('function')
  })

  it('should lock properties on an object', async () => {
    const { lockedProps } = await import('@hyperfrontend/immutable-api-utils')

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

  it('should export locked decorator', async () => {
    const { locked } = await import('@hyperfrontend/immutable-api-utils')
    expect(typeof locked).toBe('function')
  })
})
