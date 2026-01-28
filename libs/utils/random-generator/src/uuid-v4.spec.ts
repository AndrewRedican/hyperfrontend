import { getType } from '@hyperfrontend/data-utils'
import { uuidV4, isUuidV4 } from './uuid-v4'

describe('UUID generation and validation', () => {
  it('generates a UUID v4', () => {
    const uuid = uuidV4()
    expect(getType(uuid)).toBe('string')
    expect(uuid).toHaveLength(36)
  })

  it('validates a UUID v4', () => {
    const uuid = uuidV4()
    expect(isUuidV4(uuid)).toBeTruthy()
  })

  it('invalidates a bad UUID', () => {
    const badUUID = '123e4567-e89b-12d3-a456-426614174000' // version 1 UUID
    expect(isUuidV4(badUUID)).toBeFalsy()
  })
})
