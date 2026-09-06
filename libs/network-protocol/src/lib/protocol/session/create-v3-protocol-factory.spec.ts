import { describe, expect, it } from '@hyperfrontend/testing'
import { createV3ProtocolFactory, V3 } from './create-v3-protocol-factory'
import { createMockLogger, nodeCrypto } from './test-fixtures'

describe('createV3ProtocolFactory', () => {
  it('names the protocol v3 with version byte 3', () => {
    expect(V3).toEqual({ id: 'v3', version: 3 })
  })

  it('returns a provider for a valid logger', () => {
    expect(createV3ProtocolFactory(nodeCrypto)(createMockLogger())).toEqual(expect.any(Function))
  })

  it('throws without a valid logger', () => {
    expect(() => createV3ProtocolFactory(nodeCrypto)(null as never)).toThrow('Cannot create protocol provider without a valid logger')
  })
})
