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
    expect(err.message).toBe('msg')
    expect(err.path).toBe('/foo')
    expect(err.instance).toBe(1)
    expect(err.code).toBe('ERR')
    expect(err.params?.['foo']).toBe('bar')
  })

  it('ValidationResult structure', () => {
    const result: ValidationResult = {
      valid: false,
      errors: [],
    }
    expect(result.valid).toBe(false)
    expect(Array.isArray(result.errors)).toBe(true)
  })

  it('ValidateOptions structure', () => {
    const opts: ValidateOptions = { collectAllErrors: false }
    expect(opts.collectAllErrors).toBe(false)
  })
})
