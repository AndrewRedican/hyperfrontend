import { describe, expect, it } from '@hyperfrontend/testing'
import { isValidLogger } from './is-valid-logger'
import { logger } from './logger'

describe('isValidLogger', () => {
  it('returns true for a valid logger', () => {
    expect(isValidLogger(logger)).toBe(true)
  })

  it.each([{}, { error: () => void 0 }])('returns false for the invalid logger %p', (candidate: object) => {
    expect(isValidLogger(candidate)).toBe(false)
  })
})
