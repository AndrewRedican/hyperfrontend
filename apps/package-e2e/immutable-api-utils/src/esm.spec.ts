/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/immutable-api-utils`.
 *
 * The packed tarball is installed into a consumer outside the workspace and every test runs under plain Node
 * with no loader hooks, so the entries resolve and behave as a consumer's `import` sees them.
 */

import { describe, expect, it } from '@hyperfrontend/testing'
import { usePackedConsumer } from '@hyperfrontend/testing/consumer'

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL })

describe('@hyperfrontend/immutable-api-utils ESM', () => {
  it('imports every export entry', () => {
    expect(consumer.entries('import').filter((entry) => !entry.ok)).toEqual([])
  })

  it('exposes the documented surface of the main entry', () => {
    const surface = consumer.run(async () => {
      const entry = await import('@hyperfrontend/immutable-api-utils')
      return Object.fromEntries(Object.keys(entry).map((name) => [name, typeof (entry as Record<string, unknown>)[name]]))
    })
    expect(surface).toEqual(
      expect.objectContaining({
        lockedPropertyDescriptors: 'function',
        lockedProps: 'function',
        locked: 'function',
      })
    )
  })

  it('creates locked property descriptors', () => {
    const descriptor = consumer.run(async () => {
      const { lockedPropertyDescriptors } = await import('@hyperfrontend/immutable-api-utils')
      return lockedPropertyDescriptors('test-value')
    })
    expect(descriptor).toEqual({
      value: 'test-value',
      writable: false,
      configurable: false,
      enumerable: false,
    })
  })

  it('locks properties on an object with the given values', () => {
    const values = consumer.run(async () => {
      const { lockedProps } = await import('@hyperfrontend/immutable-api-utils')
      const target: Record<string, unknown> = {}
      lockedProps(target, [
        ['foo', 'bar'],
        ['num', 42],
      ])
      return [target.foo, target.num]
    })
    expect(values).toEqual(['bar', 42])
  })

  it('locks properties on an object against reassignment', () => {
    const outcome = consumer.run(async () => {
      const { lockedProps } = await import('@hyperfrontend/immutable-api-utils')
      const target: Record<string, unknown> = {}
      lockedProps(target, [['foo', 'bar']])
      try {
        target.foo = 'changed'
        return 'reassigned'
      } catch {
        return 'refused'
      }
    })
    expect(outcome).toBe('refused')
  })

  it('freezes an object through the built-in copy entry', () => {
    const frozen = consumer.run(async () => {
      const { freeze } = await import('@hyperfrontend/immutable-api-utils/built-in-copy/object')
      return Object.isFrozen(freeze({ a: 1 }))
    })
    expect(frozen).toBe(true)
  })

  it('exposes the locked decorator through its own entry', () => {
    const kind = consumer.run(async () => {
      const { locked } = await import('@hyperfrontend/immutable-api-utils/locked')
      return typeof locked
    })
    expect(kind).toBe('function')
  })
})
