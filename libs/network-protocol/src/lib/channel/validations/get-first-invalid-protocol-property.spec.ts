import { describe, expect, it } from '@hyperfrontend/testing'
import { getFirstInvalidProtocolProperty } from './get-first-invalid-protocol-property'

describe('getFirstInvalidProtocolProperty', () => {
  const baseProtocol = {
    seal: () => void 0,
    open: () => void 0,
    hello: () => void 0,
    isHello: () => void 0,
    acceptHello: () => void 0,
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

  it('reports the opener when it is missing', () => {
    expect(getFirstInvalidProtocolProperty({ ...baseProtocol, open: undefined })).toEqual('open')
  })
})
