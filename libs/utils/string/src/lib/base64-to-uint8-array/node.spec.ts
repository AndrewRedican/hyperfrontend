import { describe, expect, it } from '@hyperfrontend/testing'
import { BASE_64_ENCODING_SAMPLES } from '../test-fixtures'
import { utf8StringToUint8Array } from '../utf8-string-to-uint8-array/node/utf8-string-to-uint8-array'
import { base64ToUint8Array } from './node/base64-to-uint8-array'

describe('base64ToUint8Array (node)', () => {
  const { SIMPLE, NON_ASCII, EMPTY } = BASE_64_ENCODING_SAMPLES

  it('decodes standard base64 to the encoded bytes', () => {
    expect(base64ToUint8Array(SIMPLE.ENCODED)).toEqual(utf8StringToUint8Array(SIMPLE.DECODED))
  })

  it('decodes url-safe base64 without padding', () => {
    expect(base64ToUint8Array(SIMPLE.ENCODED_NO_PADDING)).toEqual(utf8StringToUint8Array(SIMPLE.DECODED))
  })

  it('decodes an empty string to an empty array', () => {
    expect(base64ToUint8Array(EMPTY.ENCODED)).toEqual(utf8StringToUint8Array(EMPTY.DECODED))
  })

  it('starts the decoded bytes at offset zero', () => {
    expect(base64ToUint8Array(SIMPLE.ENCODED).byteOffset).toBe(0)
  })

  it('sizes the underlying buffer to the decoded bytes alone', () => {
    const bytes = base64ToUint8Array(SIMPLE.ENCODED)
    expect(bytes.buffer.byteLength).toBe(bytes.byteLength)
  })

  it('gives each decode its own underlying buffer', () => {
    const first = base64ToUint8Array(SIMPLE.ENCODED)
    expect(base64ToUint8Array(NON_ASCII.ENCODED).buffer).not.toBe(first.buffer)
  })
})
