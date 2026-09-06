import { describe, expect, it } from '@hyperfrontend/testing'
import { createV4ProtocolFactory, isValidSharedKey, MIN_SHARED_KEY_LENGTH, V4 } from './create-v4-protocol-factory'
import { createMockLogger, nodeCrypto, SHARED_KEY } from './test-fixtures'

describe('createV4ProtocolFactory', () => {
  it('names the protocol v4 with version byte 4', () => {
    expect(V4).toEqual({ id: 'v4', version: 4 })
  })

  it('returns a provider for a valid logger', () => {
    expect(createV4ProtocolFactory(nodeCrypto)(createMockLogger(), SHARED_KEY)).toEqual(expect.any(Function))
  })

  it('throws for a shared key shorter than the minimum', () => {
    expect(() => createV4ProtocolFactory(nodeCrypto)(createMockLogger(), 'short')).toThrow(
      `Cannot create the v4 protocol without a shared key of at least ${MIN_SHARED_KEY_LENGTH} characters`
    )
  })

  it('throws for a missing shared key', () => {
    expect(() => createV4ProtocolFactory(nodeCrypto)(createMockLogger(), undefined as never)).toThrow('Cannot create the v4 protocol')
  })
})

describe('isValidSharedKey', () => {
  it('accepts a string of the minimum length', () => {
    expect(isValidSharedKey('0123456789abcdef')).toBe(true)
  })

  it('rejects a shorter string', () => {
    expect(isValidSharedKey('0123456789abcde')).toBe(false)
  })

  it('rejects a non-string', () => {
    expect(isValidSharedKey(16)).toBe(false)
  })
})
