import type { Protocol } from '../../channel/model'
import { describe, expect, it } from '@hyperfrontend/testing'
import { isValidProtocol } from './is-valid-protocol'

describe('isValidProtocol', () => {
  const baseProtocol = {
    packetEncryption: () => void 0,
    packetDecryption: () => void 0,
    packetObfuscation: () => void 0,
    packetDeobfuscation: () => void 0,
    send: () => void 0,
    receive: () => void 0,
    getLogger: () => void 0,
  } as unknown as Protocol

  it('returns true for all keys with a valid protocol object', () => {
    const result = isValidProtocol(baseProtocol)
    Object.values(result).forEach((value) => expect(value).toBe(true))
  })

  it('identifies the first non-function property (packetEncryption) and leaves others as undefined', () => {
    const protocolWithFirstNonFunction = {
      ...baseProtocol,
      packetEncryption: 'not a function',
    }
    const result = isValidProtocol(protocolWithFirstNonFunction)
    expect(result.packetEncryption).toBe(false)
    expect(result.packetDecryption).toBeUndefined()
    expect(result.packetObfuscation).toBeUndefined()
    expect(result.packetDeobfuscation).toBeUndefined()
    expect(result.send).toBeUndefined()
    expect(result.receive).toBeUndefined()
  })

  it('identifies the first non-function property (packetDecryption) when previous is valid', () => {
    const protocolWithNonFunction = {
      ...baseProtocol,
      packetDecryption: 123,
    }
    const result = isValidProtocol(protocolWithNonFunction)
    expect(result.packetEncryption).toBe(true)
    expect(result.packetDecryption).toBe(false)
    expect(result.packetObfuscation).toBeUndefined()
    expect(result.packetDeobfuscation).toBeUndefined()
    expect(result.send).toBeUndefined()
    expect(result.receive).toBeUndefined()
  })
})
