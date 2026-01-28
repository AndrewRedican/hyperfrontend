/**
 * Tests for packet base creator
 */

import { createPacketBase } from './create-packet-base'

describe('createPacketBase', () => {
  const validOrigin = '550e8400-e29b-41d4-a716-446655440000'
  const validTarget = '641c7fcb-d7dd-4a18-ab50-ce797192ed82'

  it('creates a packet base with valid origin and target', () => {
    const result = createPacketBase(validOrigin, validTarget)

    expect(result).toEqual({ origin: validOrigin, target: validTarget })
  })

  it('returns frozen object', () => {
    const result = createPacketBase(validOrigin, validTarget)

    expect(Object.isFrozen(result)).toBe(true)
  })

  it('throws error when origin is invalid', () => {
    expect(() => createPacketBase('', validTarget)).toThrow('Cannot create a packet without a valid origin value')
  })

  it('throws error when target is invalid', () => {
    expect(() => createPacketBase(validOrigin, '')).toThrow('Cannot create a packet without a valid target value')
  })
})
