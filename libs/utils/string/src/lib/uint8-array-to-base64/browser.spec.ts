/** @jest-environment jsdom */
import { utf8StringToUint8Array, base64ToUint8Array, uint8ArrayToUtf8String } from '../../browser'
import { uint8ArrayToBase64 } from './browser'

describe(`uint8ArrayToBase64 (browser)`, () => {
  const message = 'supercalifragilisticexpialidoceous'
  const messageUint8Array = utf8StringToUint8Array(message)

  it('returns a serialized message that can be deserialized', () => {
    const serializedMessage = uint8ArrayToBase64(messageUint8Array)
    const deserialized = base64ToUint8Array(serializedMessage)
    expect(uint8ArrayToUtf8String(deserialized)).toEqual(message)
  })
})
