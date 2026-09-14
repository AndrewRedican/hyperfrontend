import type { Schema } from '../types/schema'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { validate } from './validate'

describe('validate pattern guards inside composition keywords', () => {
  const guarded: Schema = { type: 'string', pattern: '^x$' }

  it('sends anyOf branch patterns to the safety checker', () => {
    const checker = jest.fn().mockReturnValue({ safe: true })
    validate('x', { anyOf: [guarded] }, { safePatterns: checker })

    expect(checker).toHaveBeenCalledWith('^x$')
  })

  it('sends oneOf branch patterns to the safety checker', () => {
    const checker = jest.fn().mockReturnValue({ safe: true })
    validate('x', { oneOf: [guarded] }, { safePatterns: checker })

    expect(checker).toHaveBeenCalledWith('^x$')
  })

  it('sends not branch patterns to the safety checker', () => {
    const checker = jest.fn().mockReturnValue({ safe: true })
    validate('x', { not: guarded }, { safePatterns: checker })

    expect(checker).toHaveBeenCalledWith('^x$')
  })

  it('sends patternProperties inside a branch to the safety checker', () => {
    const checker = jest.fn().mockReturnValue({ safe: true })
    validate({ key: 'x' }, { anyOf: [{ patternProperties: { '^k': { type: 'string' } } }] }, { safePatterns: checker })

    expect(checker).toHaveBeenCalledWith('^k')
  })

  it('rejects an unsafe pattern under anyOf with the built-in heuristics', () => {
    const result = validate('aaa', { anyOf: [{ type: 'string', pattern: '(a+)+' }] }, { safePatterns: true })

    expect(result).toEqual({ valid: false, errors: [expect.objectContaining({ code: 'anyOf' })] })
  })

  it('fails a not branch whose regex is invalid when strictPatterns is on', () => {
    const result = validate('abc', { not: { type: 'string', pattern: '[invalid' } }, { strictPatterns: true })

    expect(result).toEqual({ valid: true, errors: [] })
  })

  it('treats an invalid regex in a not branch as matching when strictPatterns is off', () => {
    const result = validate('abc', { not: { type: 'string', pattern: '[invalid' } })

    expect(result.errors).toEqual([expect.objectContaining({ code: 'not' })])
  })
})
