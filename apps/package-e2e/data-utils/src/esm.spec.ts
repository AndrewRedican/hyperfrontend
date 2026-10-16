/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/data-utils`
 * Tests that the package is importable and exports work correctly.
 */

import { describe, it, expect } from '@hyperfrontend/testing'

describe('@hyperfrontend/data-utils ESM', () => {
  it('is importable', async () => {
    const dataUtils = await import('@hyperfrontend/data-utils')
    expect(dataUtils).toBeDefined()
  })

  it('exports getType function', async () => {
    const { getType } = await import('@hyperfrontend/data-utils')
    expect(typeof getType).toBe('function')
  })

  it.each([
    ['hello', 'string'],
    [123, 'number'],
    [true, 'boolean'],
    [null, 'null'],
    [undefined, 'undefined'],
    [[], 'array'],
    [{}, 'object'],
  ])('detects the type of %p as %s', async (input, expected) => {
    const { getType } = await import('@hyperfrontend/data-utils')

    expect(getType(input)).toBe(expected)
  })

  it('exports isIdentical function', async () => {
    const { isIdentical } = await import('@hyperfrontend/data-utils')
    expect(typeof isIdentical).toBe('function')
  })

  it('detects structurally equal objects as identical', async () => {
    const { isIdentical } = await import('@hyperfrontend/data-utils')

    expect(isIdentical({ a: 1 }, { a: 1 })).toBe(true)
  })

  it('detects objects with different values as not identical', async () => {
    const { isIdentical } = await import('@hyperfrontend/data-utils')

    expect(isIdentical({ a: 1 }, { a: 2 })).toBe(false)
  })

  it('detects structurally equal arrays as identical', async () => {
    const { isIdentical } = await import('@hyperfrontend/data-utils')

    expect(isIdentical([1, 2, 3], [1, 2, 3])).toBe(true)
  })

  it('exports sameType function', async () => {
    const { sameType } = await import('@hyperfrontend/data-utils')
    expect(typeof sameType).toBe('function')
  })

  it('names the type two strings share through sameType', async () => {
    const { sameType } = await import('@hyperfrontend/data-utils')

    expect(sameType('hello', 'world')).toBe('string')
  })

  it('returns false from sameType for a string and a number', async () => {
    const { sameType } = await import('@hyperfrontend/data-utils')

    expect(sameType('hello', 123)).toBe(false)
  })

  it('exports traverse function', async () => {
    const { traverse } = await import('@hyperfrontend/data-utils')
    expect(typeof traverse).toBe('function')
  })

  it('exports selectiveCopy function', async () => {
    const { selectiveCopy } = await import('@hyperfrontend/data-utils')
    expect(typeof selectiveCopy).toBe('function')
  })

  it('exports hasCircularReference function', async () => {
    const { hasCircularReference } = await import('@hyperfrontend/data-utils')
    expect(typeof hasCircularReference).toBe('function')
  })

  it('reports a circular reference only once the object references itself', async () => {
    const { hasCircularReference } = await import('@hyperfrontend/data-utils')

    const obj: Record<string, unknown> = { a: 1 }
    const beforeSelfReference = hasCircularReference(obj)

    obj.self = obj
    const afterSelfReference = hasCircularReference(obj)

    expect({ beforeSelfReference, afterSelfReference }).toEqual({ beforeSelfReference: false, afterSelfReference: true })
  })

  it('exports getDepth function', async () => {
    const { getDepth } = await import('@hyperfrontend/data-utils')
    expect(typeof getDepth).toBe('function')
  })

  it('exports locateKey function', async () => {
    const { locateKey } = await import('@hyperfrontend/data-utils')
    expect(typeof locateKey).toBe('function')
  })
})
