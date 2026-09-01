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

  it('correctly detects types', async () => {
    const { getType } = await import('@hyperfrontend/data-utils')

    expect(getType('hello')).toBe('string')
    expect(getType(123)).toBe('number')
    expect(getType(true)).toBe('boolean')
    expect(getType(null)).toBe('null')
    expect(getType(undefined)).toBe('undefined')
    expect(getType([])).toBe('array')
    expect(getType({})).toBe('object')
  })

  it('exports isIdentical function', async () => {
    const { isIdentical } = await import('@hyperfrontend/data-utils')
    expect(typeof isIdentical).toBe('function')
  })

  it('detects identical values', async () => {
    const { isIdentical } = await import('@hyperfrontend/data-utils')

    expect(isIdentical({ a: 1 }, { a: 1 })).toBe(true)
    expect(isIdentical({ a: 1 }, { a: 2 })).toBe(false)
    expect(isIdentical([1, 2, 3], [1, 2, 3])).toBe(true)
  })

  it('exports sameType function', async () => {
    const { sameType } = await import('@hyperfrontend/data-utils')
    expect(typeof sameType).toBe('function')

    expect(sameType('hello', 'world')).toBe('string')
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

    const obj: Record<string, unknown> = { a: 1 }
    expect(hasCircularReference(obj)).toBe(false)

    obj.self = obj
    expect(hasCircularReference(obj)).toBe(true)
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
