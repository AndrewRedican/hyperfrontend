import { createUint8Array } from '@hyperfrontend/immutable-api-utils/built-in-copy/typed-arrays'
import { describe, expect, it } from '@hyperfrontend/testing'
import { getUtf8Decoder } from './utf8-decoder'

describe('getUtf8Decoder', () => {
  it('returns a decoder that decodes utf8 bytes', () => {
    expect(getUtf8Decoder().decode(createUint8Array([104, 105]))).toBe('hi')
  })

  it('returns the same memoized decoder on repeated calls', () => {
    expect(getUtf8Decoder()).toBe(getUtf8Decoder())
  })
})
