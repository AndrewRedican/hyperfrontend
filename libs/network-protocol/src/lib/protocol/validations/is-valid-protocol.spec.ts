import type { Protocol } from '../../channel/model'
import { describe, expect, it } from '@hyperfrontend/testing'
import { isValidProtocol } from './is-valid-protocol'

describe('isValidProtocol', () => {
  const baseProtocol = {
    seal: () => void 0,
    open: () => void 0,
    hello: () => void 0,
    isHello: () => void 0,
    acceptHello: () => void 0,
    send: () => void 0,
    receive: () => void 0,
    getLogger: () => void 0,
  } as unknown as Protocol

  it('returns true for every key of a valid protocol object', () => {
    expect(isValidProtocol(baseProtocol)).toEqual({
      seal: true,
      open: true,
      hello: true,
      isHello: true,
      acceptHello: true,
      send: true,
      receive: true,
      getLogger: true,
    })
  })

  it('stops at the first non-function property', () => {
    expect(isValidProtocol({ ...baseProtocol, seal: 'not a function' })).toEqual({
      seal: false,
      open: undefined,
      hello: undefined,
      isHello: undefined,
      acceptHello: undefined,
      send: undefined,
      receive: undefined,
      getLogger: undefined,
    })
  })

  it('marks the properties before the first invalid one as valid', () => {
    expect(isValidProtocol({ ...baseProtocol, open: 123 })).toEqual({
      seal: true,
      open: false,
      hello: undefined,
      isHello: undefined,
      acceptHello: undefined,
      send: undefined,
      receive: undefined,
      getLogger: undefined,
    })
  })
})
