import { createUnencryptedPacket } from './create-unencrypted-packet'

describe('createUnencryptedPacket', () => {
  const validOrigin = '550e8400-e29b-41d4-a716-446655440000'
  const validTarget = '641c7fcb-d7dd-4a18-ab50-ce797192ed82'
  const validData = {
    pid: '5815e1c3-4083-4d3c-8795-96c4c2965f2d',
    id: '8b115bcd-d59b-4834-9290-b9a3a46df988',
    sequence: 1,
    key: '19af5c5b-b0ac-45dc-a140-fa310a84b136',
    message: '{"content":"test message"}',
    schema: {
      type: 'object',
      properties: {
        content: { type: 'string' },
      },
    },
    schemaHash: 'c3e185f09eb2087519e0266b0538551ff121901e1c9ebbe26d8ec4c0ea1bcd4b',
  }

  it('creates an unencrypted packet with valid inputs', () => {
    const result = createUnencryptedPacket(validOrigin, validTarget, validData)

    expect(result).toEqual({
      origin: validOrigin,
      target: validTarget,
      data: validData,
    })
  })

  it('returns frozen object', () => {
    const result = createUnencryptedPacket(validOrigin, validTarget, validData)

    expect(Object.isFrozen(result)).toBe(true)
  })

  it('throws error when data is invalid', () => {
    const invalidData = { invalid: 'data' }

    expect(() => createUnencryptedPacket(validOrigin, validTarget, <unknown>invalidData)).toThrow(
      'Cannot create a packet without a valid data value'
    )
  })

  it('throws error when origin is invalid', () => {
    expect(() => createUnencryptedPacket('', validTarget, validData)).toThrow('Cannot create a packet without a valid origin value')
  })

  it('throws error when target is invalid', () => {
    expect(() => createUnencryptedPacket(validOrigin, '', validData)).toThrow('Cannot create a packet without a valid target value')
  })
})
