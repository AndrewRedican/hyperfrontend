/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/json-utils`.
 *
 * The packed tarball is installed into a consumer outside the workspace and every test runs under plain Node
 * with no loader hooks, so the entries resolve and behave as a consumer's `import` sees them.
 */

import { describe, expect, it } from '@hyperfrontend/testing'
import { usePackedConsumer } from '@hyperfrontend/testing/consumer'

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL })

describe('@hyperfrontend/json-utils ESM', () => {
  it('imports every export entry', () => {
    expect(consumer.entries('import').filter((entry) => !entry.ok)).toEqual([])
  })

  it('exposes the documented surface of the main entry', () => {
    const surface = consumer.run(async () => {
      const entry = await import('@hyperfrontend/json-utils')
      return Object.fromEntries(Object.keys(entry).map((name) => [name, typeof (entry as Record<string, unknown>)[name]]))
    })
    expect(surface).toEqual(
      expect.objectContaining({
        validate: 'function',
        createValidator: 'function',
        toJsonSchema: 'function',
        isEqual: 'function',
      })
    )
  })

  it('validates data that satisfies a schema as valid', () => {
    const valid = consumer.run(async () => {
      const { validate } = await import('@hyperfrontend/json-utils')
      const schema = { type: 'object', properties: { name: { type: 'string' }, age: { type: 'number' } }, required: ['name'] } as const
      return validate({ name: 'John', age: 30 }, schema).valid
    })
    expect(valid).toBe(true)
  })

  it('validates data missing a required property as invalid', () => {
    const valid = consumer.run(async () => {
      const { validate } = await import('@hyperfrontend/json-utils')
      const schema = { type: 'object', properties: { name: { type: 'string' }, age: { type: 'number' } }, required: ['name'] } as const
      return validate({ age: 30 }, schema).valid
    })
    expect(valid).toBe(false)
  })

  it('creates a reusable validator that accepts data matching its schema', () => {
    const valid = consumer.run(async () => {
      const { createValidator } = await import('@hyperfrontend/json-utils')
      const isString = createValidator({ type: 'string' })
      return isString('hello').valid
    })
    expect(valid).toBe(true)
  })

  it('creates a reusable validator that rejects data of another type', () => {
    const valid = consumer.run(async () => {
      const { createValidator } = await import('@hyperfrontend/json-utils')
      const isString = createValidator({ type: 'string' })
      return isString(1).valid
    })
    expect(valid).toBe(false)
  })

  it('generates an object schema with properties from data', () => {
    const schema = consumer.run(async () => {
      const { toJsonSchema } = await import('@hyperfrontend/json-utils')
      const generated = toJsonSchema({ name: 'John', age: 30 })
      return { type: generated.type, properties: Object.keys(generated.properties ?? {}).sort() }
    })
    expect(schema).toEqual({
      type: 'object',
      properties: ['age', 'name'],
    })
  })

  it('compares values deeply through isEqual', () => {
    const equal = consumer.run(async () => {
      const { isEqual } = await import('@hyperfrontend/json-utils')
      return [isEqual({ a: [1] }, { a: [1] }), isEqual({ a: [1] }, { a: [2] })]
    })
    expect(equal).toEqual([true, false])
  })
})
