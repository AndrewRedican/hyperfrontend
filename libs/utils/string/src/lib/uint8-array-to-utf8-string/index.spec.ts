import { uint8ArrayToUtf8String } from './index'
import { UINT8_CONVERTION_SAMPLES } from '../shared-consts'

describe('uint8ArrayToUtf8String', () => {
  const { SIMPLE, NON_ASCII, EMPTY } = UINT8_CONVERTION_SAMPLES
  it(`converts uint8 array to a simple string`, () => {
    expect(uint8ArrayToUtf8String(SIMPLE.ARRAY)).toEqual(SIMPLE.STRING)
  })

  it(`converts a uint8 array to non-ascii string`, () => {
    expect(uint8ArrayToUtf8String(NON_ASCII.ARRAY)).toEqual(NON_ASCII.STRING)
  })

  it(`converts an uint8 array to empty string`, () => {
    expect(uint8ArrayToUtf8String(EMPTY.ARRAY)).toEqual(EMPTY.STRING)
  })
})
