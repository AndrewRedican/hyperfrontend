import { describe, expect, it } from '@hyperfrontend/testing'
import { session } from '../mocks'
import { isValidSession } from './is-valid-session'

describe('isValidSession', () => {
  it('accepts a complete session', () => {
    expect(isValidSession(session)).toBe(true)
  })

  it('rejects a value that is not an object', () => {
    expect(isValidSession('session')).toBe(false)
  })

  it('rejects an empty protocol id', () => {
    expect(isValidSession({ ...session, protocol: '' })).toBe(false)
  })

  it('rejects an unknown role', () => {
    expect(isValidSession({ ...session, role: 'observer' })).toBe(false)
  })

  it('rejects a missing local id', () => {
    expect(isValidSession({ ...session, localId: undefined })).toBe(false)
  })

  it('rejects a missing peer id', () => {
    expect(isValidSession({ ...session, peerId: '' })).toBe(false)
  })
})
