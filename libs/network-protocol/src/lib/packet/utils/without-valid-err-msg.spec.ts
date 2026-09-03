import { describe, expect, it } from '@hyperfrontend/testing'
import { withoutValidErrorMessage } from './without-valid-err-msg'

describe('withoutValidErrorMessage', () => {
  it('returns error message with label', () => {
    const result = withoutValidErrorMessage('origin')
    expect(result).toBe('Cannot create a packet without a valid origin value')
  })

  it('returns error message for different labels', () => {
    expect(withoutValidErrorMessage('target')).toBe('Cannot create a packet without a valid target value')
    expect(withoutValidErrorMessage('data')).toBe('Cannot create a packet without a valid data value')
  })
})
