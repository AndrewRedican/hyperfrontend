import { arrayBufferToUtf8String } from './array-buffer-to-utf8-string'
import { UINT8_CONVERTION_SAMPLES } from '../shared-consts'

describe('arrayBufferToUtf8String', () => {
  const { SIMPLE, NON_ASCII, EMPTY } = UINT8_CONVERTION_SAMPLES
  it(`converts uint8 array to a simple string`, () => {
    expect(arrayBufferToUtf8String(SIMPLE.ARRAY.buffer)).toEqual(SIMPLE.STRING)
  })

  it(`converts a uint8 array to non-ascii string`, () => {
    expect(arrayBufferToUtf8String(NON_ASCII.ARRAY.buffer)).toEqual(NON_ASCII.STRING)
  })

  it(`converts an uint8 array to empty string`, () => {
    expect(arrayBufferToUtf8String(EMPTY.ARRAY.buffer)).toEqual(EMPTY.STRING)
  })
})
