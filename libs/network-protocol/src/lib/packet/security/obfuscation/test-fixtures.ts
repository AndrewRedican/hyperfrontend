import type { SerializedEncryptedPacket } from '../../model'
import { createUint8Array } from '@hyperfrontend/immutable-api-utils/built-in-copy/typed-arrays'

/**
 * Valid UUID v4 values for packet origin and target fields.
 */
export const testUUIDs = {
  origin1: '550e8400-e29b-41d4-a716-446655440000',
  origin2: '0a15fa91-e1ca-47f7-9e70-c1744156e6fc',
  target1: '641c7fcb-d7dd-4a18-ab50-ce797192ed82',
  target2: '7d3f9e1a-c8b4-4a2d-9f6e-8c7b5a4d3e2f',
}

/**
 * Test passwords for obfuscation/deobfuscation.
 */
export const testPasswords = {
  valid: 'secure-obfuscation-password-123',
  alternative: 'another-secure-password-456',
  weak: 'weak',
  empty: '',
}

/**
 * Sample serialized encrypted packet for obfuscation testing.
 */
export const sampleSerializedEncryptedPacket: SerializedEncryptedPacket = {
  origin: testUUIDs.origin1,
  target: testUUIDs.target1,
  data: 'encrypted-data-string-base64-encoded',
}

/**
 * Alternative serialized encrypted packet for testing different data.
 */
export const alternativeSerializedEncryptedPacket: SerializedEncryptedPacket = {
  origin: testUUIDs.origin2,
  target: testUUIDs.target2,
  data: 'another-encrypted-data-string-different',
}

/**
 * Invalid test cases for error handling validation.
 */
export const invalidPacketObfuscationTestCases = [
  {
    description: 'null packet',
    packet: null,
    password: testPasswords.valid,
  },
  {
    description: 'undefined packet',
    packet: undefined,
    password: testPasswords.valid,
  },
  {
    description: 'packet missing origin field',
    packet: {
      target: testUUIDs.target1,
      data: 'encrypted-data',
    },
    password: testPasswords.valid,
  },
  {
    description: 'packet missing target field',
    packet: {
      origin: testUUIDs.origin1,
      data: 'encrypted-data',
    },
    password: testPasswords.valid,
  },
  {
    description: 'packet missing data field',
    packet: {
      origin: testUUIDs.origin1,
      target: testUUIDs.target1,
    },
    password: testPasswords.valid,
  },
  {
    description: 'packet with invalid origin UUID',
    packet: {
      origin: 'invalid-uuid',
      target: testUUIDs.target1,
      data: 'encrypted-data',
    },
    password: testPasswords.valid,
  },
  {
    description: 'packet with invalid target UUID',
    packet: {
      origin: testUUIDs.origin1,
      target: 'invalid-uuid',
      data: 'encrypted-data',
    },
    password: testPasswords.valid,
  },
  {
    description: 'packet with non-string data',
    packet: {
      origin: testUUIDs.origin1,
      target: testUUIDs.target1,
      data: createUint8Array([1, 2, 3]),
    },
    password: testPasswords.valid,
  },
]
