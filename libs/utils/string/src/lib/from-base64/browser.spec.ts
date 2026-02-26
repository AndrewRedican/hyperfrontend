/** @jest-environment jsdom */
import { fromBase64 } from './browser/from-base64'
import { BASE_64_ENCODING_SAMPLES } from '../shared-consts'

describe('fromBase64 (browser)', () => {
  const { SIMPLE, NON_ASCII, EMPTY } = BASE_64_ENCODING_SAMPLES

  it('correctly decodes an encoded simple string', () => {
    expect(fromBase64(SIMPLE.ENCODED)).toBe(SIMPLE.DECODED)
  })

  it('correctly decodes an encoded non-ascii string', () => {
    expect(fromBase64(NON_ASCII.ENCODED)).toBe(NON_ASCII.DECODED)
  })

  it('correctly decodes an encoded empty string', () => {
    expect(fromBase64(EMPTY.ENCODED)).toBe(EMPTY.DECODED)
  })
})
