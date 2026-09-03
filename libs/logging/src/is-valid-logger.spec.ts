import { describe, expect, it } from '@hyperfrontend/testing'
import { isValidLogger } from './is-valid-logger'
import { logger } from './logger'

describe('isValidLogger', () => {
  it('returns true for a valid logger', () => {
    expect(isValidLogger(logger)).toBe(true)
  })

  it('returns false for an invalid loggeer', () => {
    expect(isValidLogger({})).toBe(false)
    expect(isValidLogger({ error: () => void 0 })).toBe(false)
  })
})
