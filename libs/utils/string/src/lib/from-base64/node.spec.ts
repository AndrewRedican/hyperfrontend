/** @jest-environment node */
import { describe, expect, it } from '@hyperfrontend/testing'
import { BASE_64_ENCODING_SAMPLES } from '../test-fixtures'
import { fromBase64 } from './node/from-base64'

describe('fromBase64 (node)', () => {
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
