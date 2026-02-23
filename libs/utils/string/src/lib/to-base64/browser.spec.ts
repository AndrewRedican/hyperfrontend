/** @jest-environment jsdom */
import { toBase64 } from './browser/to-base64'
import { BASE_64_ENCODING_SAMPLES } from '../shared-consts'

describe('toBase64 (browser)', () => {
  const { SIMPLE, NON_ASCII, EMPTY } = BASE_64_ENCODING_SAMPLES

  it('correctly encodes a simple string', () => {
    expect(toBase64(SIMPLE.DECODED, true, true)).toBe(SIMPLE.ENCODED)
  })

  it('correctly encodes a simple string with padding removed', () => {
    expect(toBase64(SIMPLE.DECODED, true)).toBe(SIMPLE.ENCODED_NO_PADDING)
  })

  it('correctly encodes a non-ascii string', () => {
    expect(toBase64(NON_ASCII.DECODED)).toBe(NON_ASCII.ENCODED)
  })

  it('correctly encodes an empty string', () => {
    expect(toBase64(EMPTY.DECODED)).toBe(EMPTY.ENCODED)
  })
})
