import { describe, expect, it } from '@hyperfrontend/testing'
import {
  assembleFrame,
  decodeHeader,
  decodeHello,
  encodeHeader,
  encodeHello,
  HELLO_LENGTH,
  isHelloFrame,
  MAX_COUNTER,
  nonceFor,
} from './frame'

const nonce = new Uint8Array(32).fill(7)
const publicKey = new Uint8Array(65).fill(9)
publicKey[0] = 4

describe('encodeHeader', () => {
  it('writes the version byte, the data type byte, and a big-endian 64-bit counter', () => {
    expect([...encodeHeader(4, 1)]).toEqual([4, 0, 0, 0, 0, 0, 0, 0, 0, 1])
  })

  it('spreads a counter above 2^32 across both halves', () => {
    expect([...encodeHeader(3, 4294967296 + 2)]).toEqual([3, 0, 0, 0, 0, 1, 0, 0, 0, 2])
  })
})

describe('decodeHeader', () => {
  it('reads back what encodeHeader wrote', () => {
    expect(decodeHeader(encodeHeader(3, 123456789))).toEqual({ version: 3, counter: 123456789 })
  })

  it('reads a counter above 2^32 exactly', () => {
    expect(decodeHeader(encodeHeader(4, 4294967296 * 5 + 9)).counter).toBe(4294967296 * 5 + 9)
  })

  it('reads the largest safe counter exactly', () => {
    expect(decodeHeader(encodeHeader(4, MAX_COUNTER)).counter).toBe(MAX_COUNTER)
  })

  it('reads a header that sits at an offset inside a larger buffer', () => {
    const frame = assembleFrame(encodeHeader(3, 7), new Uint8Array([1, 2, 3]))
    expect(decodeHeader(frame.subarray(0))).toEqual({ version: 3, counter: 7 })
  })
})

describe('nonceFor', () => {
  it('places the counter bytes after four zero bytes', () => {
    expect([...nonceFor(encodeHeader(4, 7))]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7])
  })

  it('leaves the version byte out of the nonce', () => {
    expect([...nonceFor(encodeHeader(3, 7))]).toEqual([...nonceFor(encodeHeader(4, 7))])
  })
})

describe('assembleFrame', () => {
  it('concatenates the header and the sealed bytes', () => {
    expect([...assembleFrame(encodeHeader(3, 1), new Uint8Array([9, 8]))]).toEqual([3, 0, 0, 0, 0, 0, 0, 0, 0, 1, 9, 8])
  })

  it('gives the frame its own buffer', () => {
    const sealed = new Uint8Array([9, 8])
    expect(assembleFrame(encodeHeader(3, 1), sealed).buffer).not.toBe(sealed.buffer)
  })
})

describe('encodeHello', () => {
  it('lays out version, type, nonce, and public key', () => {
    const hello = encodeHello(3, nonce, publicKey)
    expect([hello.length, hello[0], hello[1], hello[2], hello[34]]).toEqual([HELLO_LENGTH, 3, 1, 7, 4])
  })
})

describe('isHelloFrame', () => {
  it('recognises an encoded hello', () => {
    expect(isHelloFrame(encodeHello(3, nonce, publicKey))).toBe(true)
  })

  it('rejects a sealed frame', () => {
    expect(isHelloFrame(assembleFrame(encodeHeader(3, 1), new Uint8Array(89)))).toBe(false)
  })

  it('rejects hello-typed bytes of the wrong length', () => {
    expect(isHelloFrame(new Uint8Array([3, 1, 0]))).toBe(false)
  })
})

describe('decodeHello', () => {
  it('reads back what encodeHello wrote', () => {
    expect(decodeHello(encodeHello(4, nonce, publicKey))).toEqual({ version: 4, nonce, publicKey })
  })

  it('returns null for bytes that are not a hello', () => {
    expect(decodeHello(new Uint8Array(HELLO_LENGTH))).toBeNull()
  })

  it('returns null when the public key is not tagged as an uncompressed point', () => {
    expect(decodeHello(encodeHello(4, nonce, new Uint8Array(65)))).toBeNull()
  })

  it('copies the material out of the frame', () => {
    const frame = encodeHello(3, nonce, publicKey)
    expect(decodeHello(frame)?.nonce.buffer).not.toBe(frame.buffer)
  })
})
