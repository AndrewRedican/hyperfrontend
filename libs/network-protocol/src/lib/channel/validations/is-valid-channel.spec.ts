import { describe, expect, it } from '@hyperfrontend/testing'
import { channel } from '../creators/mocks'
import { isValidChannel } from './is-valid-channel'

describe('isValidChannel', () => {
  it('returns true for a channel', () => {
    expect(isValidChannel(channel)).toBe(true)
  })

  it.each([void 0, null, {}, { send: () => void 0 }])('returns false for %p', (value) => {
    expect(isValidChannel(value)).toBe(false)
  })
})
