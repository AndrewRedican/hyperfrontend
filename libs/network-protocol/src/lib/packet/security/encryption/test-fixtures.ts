import type { UnserializedEncryptedPacket } from '../../model'
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
 * Valid PIDs (Process IDs) for data creation.
 */
export const testPIDs = {
  pid1: '550e8400-e29b-41d4-a716-446655440005',
  pid2: '0a15fa91-e1ca-47f7-9e70-c1744156e6f1',
  pid3: '7d3f9e1a-c8b4-4a2d-9f6e-8c7b5a4d3e20',
}

/**
 * Sample unserialized encrypted packet for testing decryption.
 */
export const sampleUnserializedEncryptedPacket: UnserializedEncryptedPacket = {
  origin: testUUIDs.origin1,
  target: testUUIDs.target1,
  data: createUint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]),
}

/**
 * Test passwords for encryption/decryption.
 */
export const testPasswords = {
  valid: 'secure-packet-password-123',
  alternative: 'another-secure-password-456',
  weak: 'weak',
  empty: '',
}

/**
 * Test messages for data creation.
 */
export const testMessages = {
  simple: { message: 'test message' },
  nested: { value: 42, nested: { key: 'value' } },
  minimal: { count: 1 },
  complex: {
    nested: {
      array: [1, 2, 3],
      object: { key: 'value' },
    },
  },
}

/**
 * Invalid test cases for error handling validation.
 */
export const invalidPacketEncryptionTestCases = [
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
      data: {},
    },
    password: testPasswords.valid,
  },
  {
    description: 'packet missing target field',
    packet: {
      origin: testUUIDs.origin1,
      data: {},
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
]
