import { describe, expect, it } from '@hyperfrontend/testing'
import { isValidReceiver } from './is-valid-receiver'

describe('isValidReceiver', () => {
  it('returns true for a function only', () => {
    expect(isValidReceiver(40)).toBe(false)
    expect(isValidReceiver(null)).toBe(false)
    expect(isValidReceiver(void 0)).toBe(false)
    expect(isValidReceiver({})).toBe(false)
    expect(isValidReceiver(() => void 0)).toBe(true)
  })
})
