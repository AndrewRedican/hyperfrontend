import { describe, expect, it } from '@hyperfrontend/testing'
import { withoutValidErrorMessage } from './without-valid-err-msg'

describe('withoutValidErrorMessage', () => {
  it('returns error message with label', () => {
    const result = withoutValidErrorMessage('origin')
    expect(result).toBe('Cannot create a packet without a valid origin value')
  })

  it.each([
    ['target', 'Cannot create a packet without a valid target value'],
    ['data', 'Cannot create a packet without a valid data value'],
  ])('returns the error message for the %s label', (label, message) => {
    expect(withoutValidErrorMessage(label)).toBe(message)
  })
})
