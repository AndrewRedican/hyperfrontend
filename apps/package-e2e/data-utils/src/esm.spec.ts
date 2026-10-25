/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/data-utils`.
 *
 * The packed tarball is installed into a consumer outside the workspace and every test runs under plain Node
 * with no loader hooks, so the entries resolve and behave as a consumer's `import` sees them.
 */

import { describe, expect, it } from '@hyperfrontend/testing'
import { usePackedConsumer } from '@hyperfrontend/testing/consumer'

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL })

describe('@hyperfrontend/data-utils ESM', () => {
  it('imports every export entry', () => {
    expect(consumer.entries('import').filter((entry) => !entry.ok)).toEqual([])
  })

  it('exposes the documented surface of the main entry', () => {
    const surface = consumer.run(async () => {
      const entry = await import('@hyperfrontend/data-utils')
      return Object.fromEntries(Object.keys(entry).map((name) => [name, typeof (entry as Record<string, unknown>)[name]]))
    })
    expect(surface).toEqual(
      expect.objectContaining({
        getType: 'function',
        isIdentical: 'function',
        sameType: 'function',
        traverse: 'function',
        selectiveCopy: 'function',
        hasCircularReference: 'function',
        getDepth: 'function',
        locateKey: 'function',
      })
    )
  })

  it('names the type of each kind of value', () => {
    const types = consumer.run(async () => {
      const { getType } = await import('@hyperfrontend/data-utils')
      return [getType('hello'), getType(123), getType(true), getType(null), getType(undefined), getType([]), getType({})]
    })
    expect(types).toEqual(['string', 'number', 'boolean', 'null', 'undefined', 'array', 'object'])
  })

  it('detects structurally equal objects as identical', () => {
    const identical = consumer.run(async () => {
      const { isIdentical } = await import('@hyperfrontend/data-utils')
      return isIdentical({ a: [1, 2] }, { a: [1, 2] })
    })
    expect(identical).toBe(true)
  })

  it('detects objects with different values as not identical', () => {
    const identical = consumer.run(async () => {
      const { isIdentical } = await import('@hyperfrontend/data-utils')
      return isIdentical({ a: 1 }, { a: 2 })
    })
    expect(identical).toBe(false)
  })

  it('names the type two strings share through sameType', () => {
    const shared = consumer.run(async () => {
      const { sameType } = await import('@hyperfrontend/data-utils')
      return sameType('hello', 'world')
    })
    expect(shared).toBe('string')
  })

  it('returns false from sameType for a string and a number', () => {
    const shared = consumer.run(async () => {
      const { sameType } = await import('@hyperfrontend/data-utils')
      return sameType('hello', 123)
    })
    expect(shared).toBe(false)
  })

  it('reports a circular reference only once the object references itself', () => {
    const circular = consumer.run(async () => {
      const { hasCircularReference } = await import('@hyperfrontend/data-utils')
      const ring: Record<string, unknown> = { a: 1 }
      const before = hasCircularReference(ring)
      ring.self = ring
      return [before, hasCircularReference(ring)]
    })
    expect(circular).toEqual([false, true])
  })

  it('measures the depth of a nested object and locates its deepest path', () => {
    const depth = consumer.run(async () => {
      const { getDepth } = await import('@hyperfrontend/data-utils')
      return getDepth({ a: { b: { c: 1 } } })
    })
    expect(depth).toEqual([3, [['a', 'b', 'c']]])
  })
})
