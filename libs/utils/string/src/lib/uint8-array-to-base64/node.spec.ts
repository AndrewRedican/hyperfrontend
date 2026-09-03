import { describe, expect, it } from '@hyperfrontend/testing'
import { utf8StringToUint8Array, base64ToUint8Array, uint8ArrayToUtf8String } from '../../node'
import { uint8ArrayToBase64 } from './node/uint8-array-to-base64'

describe(`uint8ArrayToBase64 (node)`, () => {
  const message = 'supercalifragilisticexpialidoceous'
  const messageUint8Array = utf8StringToUint8Array(message)

  it('returns a serialized message that can be deserialized', () => {
    const serializedMessage = uint8ArrayToBase64(messageUint8Array)
    const deserialized = base64ToUint8Array(serializedMessage)
    expect(uint8ArrayToUtf8String(deserialized)).toEqual(message)
  })
})
