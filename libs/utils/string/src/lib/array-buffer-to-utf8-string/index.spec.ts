import { createSharedArrayBuffer, createUint8Array } from '@hyperfrontend/immutable-api-utils/built-in-copy/typed-arrays'
import { describe, expect, it } from '@hyperfrontend/testing'
import { UINT8_CONVERTION_SAMPLES } from '../test-fixtures'
import { arrayBufferToUtf8String } from './array-buffer-to-utf8-string'

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

  it(`converts a shared array buffer to a string`, () => {
    const shared = createSharedArrayBuffer(SIMPLE.ARRAY.byteLength)
    createUint8Array(shared).set(SIMPLE.ARRAY)
    expect(arrayBufferToUtf8String(shared)).toEqual(SIMPLE.STRING)
  })

  it(`converts the buffer of a Uint8Array whose backing buffer may be shared`, () => {
    const bytes: Uint8Array = SIMPLE.ARRAY
    expect(arrayBufferToUtf8String(bytes.buffer)).toEqual(SIMPLE.STRING)
  })
})
