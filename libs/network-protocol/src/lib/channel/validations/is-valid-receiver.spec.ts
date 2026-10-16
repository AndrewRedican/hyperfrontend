import { describe, expect, it } from '@hyperfrontend/testing'
import { isValidReceiver } from './is-valid-receiver'

describe('isValidReceiver', () => {
  it('returns true for a function', () => {
    expect(isValidReceiver(() => void 0)).toBe(true)
  })

  it.each([40, null, void 0, {}])('returns false for %p', (value) => {
    expect(isValidReceiver(value)).toBe(false)
  })
})
