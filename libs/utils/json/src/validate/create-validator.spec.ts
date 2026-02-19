import { createValidator } from './create-validator'
import type { Schema } from '../types'

describe('createValidator', () => {
  it('creates a reusable validator function', () => {
    const schema: Schema = { type: 'string' }
    const validator = createValidator(schema)

    expect(validator('hello').valid).toBe(true)
    expect(validator(123).valid).toBe(false)
  })

  it('can be reused multiple times', () => {
    const schema: Schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'integer' },
      },
      required: ['name'],
    }
    const validator = createValidator(schema)

    expect(validator({ name: 'Alice', age: 30 }).valid).toBe(true)
    expect(validator({ name: 'Bob' }).valid).toBe(true)
    expect(validator({}).valid).toBe(false)
    expect(validator({ name: 123 }).valid).toBe(false)
  })

  it('accepts validation options', () => {
    const schema: Schema = {
      type: 'object',
      properties: {
        a: { type: 'string' },
        b: { type: 'string' },
      },
    }
    const validator = createValidator(schema, { collectAllErrors: false })
    const result = validator({ a: 1, b: 2 })

    expect(result.valid).toBe(false)
    expect(result.errors.length).toBe(1)
  })
})
