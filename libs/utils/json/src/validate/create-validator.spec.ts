import type { Schema } from '../types/schema'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createValidator } from './create-validator'

describe('createValidator', () => {
  it('creates a reusable validator function', () => {
    const schema: Schema = { type: 'string' }
    const validator = createValidator(schema)

    expect({ string: validator('hello').valid, number: validator(123).valid }).toEqual({ string: true, number: false })
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

    expect({
      complete: validator({ name: 'Alice', age: 30 }).valid,
      requiredOnly: validator({ name: 'Bob' }).valid,
      missingRequired: validator({}).valid,
      wrongType: validator({ name: 123 }).valid,
    }).toEqual({ complete: true, requiredOnly: true, missingRequired: false, wrongType: false })
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

    expect({ valid: result.valid, errorCount: result.errors.length }).toEqual({ valid: false, errorCount: 1 })
  })
})
