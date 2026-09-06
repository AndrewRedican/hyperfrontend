import { describe, expect, it } from '@hyperfrontend/testing'
import { createProtocolError, getProtocolErrorCode, ProtocolErrorCode } from './errors'

describe('createProtocolError', () => {
  it('creates an error carrying the code and message', () => {
    expect(createProtocolError(ProtocolErrorCode.Replayed, 'Frame replayed')).toEqual(
      expect.objectContaining({ name: 'ProtocolError', code: 'replayed', message: 'Frame replayed' })
    )
  })

  it('creates a real Error', () => {
    expect(createProtocolError(ProtocolErrorCode.Malformed, 'bad')).toBeInstanceOf(Error)
  })
})

describe('getProtocolErrorCode', () => {
  it('reads the code off a protocol error', () => {
    expect(getProtocolErrorCode(createProtocolError(ProtocolErrorCode.AuthenticationFailed, 'tag'))).toBe('authentication-failed')
  })

  it('returns null for a plain error', () => {
    expect(getProtocolErrorCode(new Error('plain'))).toBeNull()
  })

  it('returns null for an object carrying an unknown code', () => {
    expect(getProtocolErrorCode({ code: 'something-else' })).toBeNull()
  })

  it('returns null for a non-object', () => {
    expect(getProtocolErrorCode('replayed')).toBeNull()
  })
})
