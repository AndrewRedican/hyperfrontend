/** @jest-environment jsdom */
import { utf8StringToUint8Array } from './browser'
import { UINT8_CONVERTION_SAMPLES } from '../shared-consts'

describe('utf8StringToUint8Array (browser)', () => {
  const { SIMPLE, NON_ASCII, EMPTY } = UINT8_CONVERTION_SAMPLES
  it(`converts a simple string to uint8 array`, () => {
    expect(utf8StringToUint8Array(SIMPLE.STRING) + '').toEqual(SIMPLE.ARRAY + '')
  })

  it(`converts a non-ascii string to uint8 array`, () => {
    expect(utf8StringToUint8Array(NON_ASCII.STRING) + '').toEqual(NON_ASCII.ARRAY + '')
  })

  it(`converts an empty string to uint8 array`, () => {
    expect(utf8StringToUint8Array(EMPTY.STRING) + '').toEqual(EMPTY.ARRAY + '')
  })
})
