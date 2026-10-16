import type { ValidationError, ValidationResult, ValidateOptions } from './validation'
import { describe, expect, it } from '@hyperfrontend/testing'

describe('Validation types', () => {
  it('ValidationError structure', () => {
    const err: ValidationError = {
      message: 'msg',
      path: '/foo',
      instance: 1,
      code: 'ERR',
      params: { foo: 'bar' },
    }
    expect(err).toEqual({ message: 'msg', path: '/foo', instance: 1, code: 'ERR', params: { foo: 'bar' } })
  })

  it('ValidationResult structure', () => {
    const result: ValidationResult = {
      valid: false,
      errors: [],
    }
    expect(result).toEqual({ valid: false, errors: expect.any(Array) })
  })

  it('ValidateOptions structure', () => {
    const opts: ValidateOptions = { collectAllErrors: false }
    expect(opts.collectAllErrors).toBe(false)
  })
})
