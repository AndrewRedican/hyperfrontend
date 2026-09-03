import { describe, expect, it } from '@hyperfrontend/testing'
import { getFirstInvalidProtocolProperty } from './get-first-invalid-protocol-property'

describe('getFirstInvalidProtocolProperty', () => {
  const baseProtocol = {
    packetEncryption: () => void 0,
    packetDecryption: () => void 0,
    packetObfuscation: () => void 0,
    packetDeobfuscation: () => void 0,
    send: () => void 0,
    receive: () => void 0,
    getLogger: () => void 0,
  } as const

  it('returns empty when all pass', () => {
    expect(getFirstInvalidProtocolProperty(baseProtocol)).toEqual('')
  })

  it('returns the first invalid property', () => {
    expect(getFirstInvalidProtocolProperty({ ...baseProtocol, send: false })).toEqual('send')
  })
})
