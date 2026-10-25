/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/immutable-api-utils`.
 *
 * The packed tarball is installed into a consumer outside the workspace and every test runs under plain Node
 * with no loader hooks, so the entries resolve and behave as a consumer's `require` sees them.
 */

'use strict'

const { describe, it, expect } = require('@hyperfrontend/testing')
const { usePackedConsumer } = require('@hyperfrontend/testing/consumer')

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL })

describe('@hyperfrontend/immutable-api-utils CJS', () => {
  it('requires every export entry', () => {
    expect(consumer.entries('require').filter((entry) => !entry.ok)).toEqual([])
  })

  it('exposes the documented surface of the main entry', () => {
    const surface = consumer.run(
      async () => {
        const entry = require('@hyperfrontend/immutable-api-utils')
        return Object.fromEntries(Object.keys(entry).map((name) => [name, typeof entry[name]]))
      },
      { kind: 'require' }
    )
    expect(surface).toEqual(
      expect.objectContaining({
        lockedPropertyDescriptors: 'function',
        lockedProps: 'function',
        locked: 'function',
      })
    )
  })

  it('creates locked property descriptors', () => {
    const descriptor = consumer.run(
      async () => {
        const { lockedPropertyDescriptors } = require('@hyperfrontend/immutable-api-utils')
        return lockedPropertyDescriptors('test-value')
      },
      { kind: 'require' }
    )
    expect(descriptor).toEqual({
      value: 'test-value',
      writable: false,
      configurable: false,
      enumerable: false,
    })
  })

  it('locks properties on an object with the given values', () => {
    const values = consumer.run(
      async () => {
        const { lockedProps } = require('@hyperfrontend/immutable-api-utils')
        const target: Record<string, unknown> = {}
        lockedProps(target, [
          ['foo', 'bar'],
          ['num', 42],
        ])
        return [target.foo, target.num]
      },
      { kind: 'require' }
    )
    expect(values).toEqual(['bar', 42])
  })

  it('locks properties on an object against reassignment', () => {
    const outcome = consumer.run(
      async () => {
        const { lockedProps } = require('@hyperfrontend/immutable-api-utils')
        const target: Record<string, unknown> = {}
        lockedProps(target, [['foo', 'bar']])
        try {
          target.foo = 'changed'
          return 'reassigned'
        } catch {
          return 'refused'
        }
      },
      { kind: 'require' }
    )
    expect(outcome).toBe('refused')
  })

  it('freezes an object through the built-in copy entry', () => {
    const frozen = consumer.run(
      async () => {
        const { freeze } = require('@hyperfrontend/immutable-api-utils/built-in-copy/object')
        return Object.isFrozen(freeze({ a: 1 }))
      },
      { kind: 'require' }
    )
    expect(frozen).toBe(true)
  })

  it('exposes the locked decorator through its own entry', () => {
    const kind = consumer.run(
      async () => {
        const { locked } = require('@hyperfrontend/immutable-api-utils/locked')
        return typeof locked
      },
      { kind: 'require' }
    )
    expect(kind).toBe('function')
  })
})
