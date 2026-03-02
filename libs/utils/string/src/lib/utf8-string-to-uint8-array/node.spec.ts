/** @jest-environment node */
import { UINT8_CONVERTION_SAMPLES } from '../shared-consts'
import { utf8StringToUint8Array } from './node/utf8-string-to-uint8-array'

describe('utf8StringToUint8Array (node)', () => {
  const { SIMPLE, NON_ASCII, EMPTY } = UINT8_CONVERTION_SAMPLES
  it(`converts a simple string to uint8 array`, () => {
    expect(utf8StringToUint8Array(SIMPLE.STRING)).toEqual(SIMPLE.ARRAY)
  })

  it(`converts a non-ascii string to uint8 array`, () => {
    expect(utf8StringToUint8Array(NON_ASCII.STRING)).toEqual(NON_ASCII.ARRAY)
  })

  it(`converts an empty string to uint8 array`, () => {
    expect(utf8StringToUint8Array(EMPTY.STRING)).toEqual(EMPTY.ARRAY)
  })
})
