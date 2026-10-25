/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/json-utils`.
 *
 * The packed tarball is installed into a consumer outside the workspace and every test runs under plain Node
 * with no loader hooks, so the entries resolve and behave as a consumer's `require` sees them.
 */

'use strict'

const { describe, it, expect } = require('@hyperfrontend/testing')
const { usePackedConsumer } = require('@hyperfrontend/testing/consumer')

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL })

describe('@hyperfrontend/json-utils CJS', () => {
  it('requires every export entry', () => {
    expect(consumer.entries('require').filter((entry) => !entry.ok)).toEqual([])
  })

  it('exposes the documented surface of the main entry', () => {
    const surface = consumer.run(
      async () => {
        const entry = require('@hyperfrontend/json-utils')
        return Object.fromEntries(Object.keys(entry).map((name) => [name, typeof entry[name]]))
      },
      { kind: 'require' }
    )
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
    const valid = consumer.run(
      async () => {
        const { validate } = require('@hyperfrontend/json-utils')
        const schema = { type: 'object', properties: { name: { type: 'string' }, age: { type: 'number' } }, required: ['name'] } as const
        return validate({ name: 'John', age: 30 }, schema).valid
      },
      { kind: 'require' }
    )
    expect(valid).toBe(true)
  })

  it('validates data missing a required property as invalid', () => {
    const valid = consumer.run(
      async () => {
        const { validate } = require('@hyperfrontend/json-utils')
        const schema = { type: 'object', properties: { name: { type: 'string' }, age: { type: 'number' } }, required: ['name'] } as const
        return validate({ age: 30 }, schema).valid
      },
      { kind: 'require' }
    )
    expect(valid).toBe(false)
  })

  it('creates a reusable validator that accepts data matching its schema', () => {
    const valid = consumer.run(
      async () => {
        const { createValidator } = require('@hyperfrontend/json-utils')
        const isString = createValidator({ type: 'string' })
        return isString('hello').valid
      },
      { kind: 'require' }
    )
    expect(valid).toBe(true)
  })

  it('creates a reusable validator that rejects data of another type', () => {
    const valid = consumer.run(
      async () => {
        const { createValidator } = require('@hyperfrontend/json-utils')
        const isString = createValidator({ type: 'string' })
        return isString(1).valid
      },
      { kind: 'require' }
    )
    expect(valid).toBe(false)
  })

  it('generates an object schema with properties from data', () => {
    const schema = consumer.run(
      async () => {
        const { toJsonSchema } = require('@hyperfrontend/json-utils')
        const generated = toJsonSchema({ name: 'John', age: 30 })
        return { type: generated.type, properties: Object.keys(generated.properties ?? {}).sort() }
      },
      { kind: 'require' }
    )
    expect(schema).toEqual({
      type: 'object',
      properties: ['age', 'name'],
    })
  })

  it('compares values deeply through isEqual', () => {
    const equal = consumer.run(
      async () => {
        const { isEqual } = require('@hyperfrontend/json-utils')
        return [isEqual({ a: [1] }, { a: [1] }), isEqual({ a: [1] }, { a: [2] })]
      },
      { kind: 'require' }
    )
    expect(equal).toEqual([true, false])
  })
})
