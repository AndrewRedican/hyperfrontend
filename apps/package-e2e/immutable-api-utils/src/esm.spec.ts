/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/immutable-api-utils`
 * Tests that the package is importable and exports work correctly.
 */

import { describe, it, expect } from '@hyperfrontend/testing'

describe('@hyperfrontend/immutable-api-utils ESM', () => {
  it('is importable', async () => {
    const immutableApiUtils = await import('@hyperfrontend/immutable-api-utils')
    expect(immutableApiUtils).toBeDefined()
  })

  it('exports lockedPropertyDescriptors', async () => {
    const { lockedPropertyDescriptors } = await import('@hyperfrontend/immutable-api-utils')
    expect(typeof lockedPropertyDescriptors).toBe('function')
  })

  it('creates locked property descriptors', async () => {
    const { lockedPropertyDescriptors } = await import('@hyperfrontend/immutable-api-utils')

    const descriptor = lockedPropertyDescriptors('test-value')
    expect(descriptor).toEqual({
      value: 'test-value',
      writable: false,
      configurable: false,
      enumerable: false,
    })
  })

  it('exports lockedProps', async () => {
    const { lockedProps } = await import('@hyperfrontend/immutable-api-utils')
    expect(typeof lockedProps).toBe('function')
  })

  it('locks properties on an object with the given values', async () => {
    const { lockedProps } = await import('@hyperfrontend/immutable-api-utils')

    const obj: Record<string, unknown> = {}
    lockedProps(obj, [
      ['foo', 'bar'],
      ['num', 42],
    ])

    expect({ foo: obj.foo, num: obj.num }).toEqual({ foo: 'bar', num: 42 })
  })

  it('locks properties on an object against reassignment', async () => {
    const { lockedProps } = await import('@hyperfrontend/immutable-api-utils')

    const obj: Record<string, unknown> = {}
    lockedProps(obj, [
      ['foo', 'bar'],
      ['num', 42],
    ])

    // Should not be writable
    expect(() => {
      obj.foo = 'changed'
    }).toThrow()
  })

  it('exports locked decorator', async () => {
    const { locked } = await import('@hyperfrontend/immutable-api-utils')
    expect(typeof locked).toBe('function')
  })
})
