import { describe, expect, it } from '@hyperfrontend/testing'
import { data } from '../../data/creators/mocks'
import { isValidUnencryptedPacket } from './is-valid-unencrypted-packet'

describe('isValidUnencryptedPacket', () => {
  const origin = '550e8400-e29b-41d4-a716-446655440000'
  const target = '641c7fcb-d7dd-4a18-ab50-ce797192ed82'

  it('accepts a packet with a valid origin, target, and data envelope', () => {
    expect(isValidUnencryptedPacket({ origin, target, data })).toBe(true)
  })

  it('rejects a value that is not an object', () => {
    expect(isValidUnencryptedPacket('packet')).toBe(false)
  })

  it('rejects a packet whose origin is not a uuid', () => {
    expect(isValidUnencryptedPacket({ origin: 'origin', target, data })).toBe(false)
  })

  it('rejects a packet whose target is not a uuid', () => {
    expect(isValidUnencryptedPacket({ origin, target: 'target', data })).toBe(false)
  })

  it('rejects a packet whose data envelope is invalid', () => {
    expect(isValidUnencryptedPacket({ origin, target, data: { invalid: true } })).toBe(false)
  })
})
