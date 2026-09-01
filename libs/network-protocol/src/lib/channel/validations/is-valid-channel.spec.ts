import { describe, expect, it } from '@hyperfrontend/testing'
import { channel } from '../creators/mocks'
import { isValidChannel } from './is-valid-channel'

describe('isValidChannel', () => {
  it('returns true for a channel', () => {
    expect(isValidChannel(channel)).toBe(true)
  })

  it('returns false for not a channel', () => {
    expect(isValidChannel(void 0)).toBe(false)
    expect(isValidChannel(null)).toBe(false)
    expect(isValidChannel({})).toBe(false)
    expect(isValidChannel({ send: () => void 0 })).toBe(false)
  })
})
