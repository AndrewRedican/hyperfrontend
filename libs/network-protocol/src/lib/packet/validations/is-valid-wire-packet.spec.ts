import { describe, expect, it } from '@hyperfrontend/testing'
import { isValidWirePacket } from './is-valid-wire-packet'

describe('isValidWirePacket', () => {
  it('accepts a non-empty byte array', () => {
    expect(isValidWirePacket(new Uint8Array([1, 2, 3]))).toBe(true)
  })

  it('rejects an empty byte array', () => {
    expect(isValidWirePacket(new Uint8Array())).toBe(false)
  })

  it('rejects a value that is not a byte array', () => {
    expect(isValidWirePacket({ data: 'not binary' })).toBe(false)
  })
})
