import type { UnserializedEncryptedPacket, SerializedEncryptedPacket } from '../model'
import { createUint8Array } from '@hyperfrontend/immutable-api-utils/built-in-copy/typed-arrays'

/**
 * Sample encrypted packet data for testing.
 */
export const sampleEncryptedData = createUint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])

/**
 * Sample unserialized encrypted packet for testing serialization.
 */
export const sampleUnserializedPacket: UnserializedEncryptedPacket = {
  origin: '550e8400-e29b-41d4-a716-446655440000',
  target: '641c7fcb-d7dd-4a18-ab50-ce797192ed82',
  data: sampleEncryptedData,
}

/**
 * Sample serialized encrypted packet for testing deserialization.
 * Note: The data field will be the base64 representation of sampleEncryptedData.
 */
export const sampleSerializedPacket: SerializedEncryptedPacket = {
  origin: '550e8400-e29b-41d4-a716-446655440000',
  target: '641c7fcb-d7dd-4a18-ab50-ce797192ed82',
  data: 'AQIDBAUGBwgJCgsMDQ4PEA==', // base64 of [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]
}

/**
 * Test cases for packet serialization/deserialization.
 */
export const packetSerializationTestCases = [
  {
    description: 'basic packet with small data',
    unserializedPacket: {
      origin: '0a15fa91-e1ca-47f7-9e70-c1744156e6fc',
      target: '641c7fcb-d7dd-4a18-ab50-ce797192ed82',
      data: createUint8Array([1, 2, 3]),
    },
    expectedSerializedData: 'AQID', // base64 of [1,2,3]
  },
  {
    description: 'packet with longer data',
    unserializedPacket: {
      origin: '0a15fa91-e1ca-47f7-9e70-c1744156e6fc',
      target: '641c7fcb-d7dd-4a18-ab50-ce797192ed82',
      data: createUint8Array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]),
    },
    expectedSerializedData: 'ChQeKDI8RlBaZA==', // base64 of the array
  },
  {
    description: 'packet with single byte',
    unserializedPacket: {
      origin: '0a15fa91-e1ca-47f7-9e70-c1744156e6fc',
      target: '641c7fcb-d7dd-4a18-ab50-ce797192ed82',
      data: createUint8Array([255]),
    },
    expectedSerializedData: '/w==', // base64 of [255]
  },
]

/**
 * Invalid test cases for error handling validation.
 */
export const invalidPacketTestCases = [
  {
    description: 'null packet',
    packet: null,
  },
  {
    description: 'undefined packet',
    packet: undefined,
  },
  {
    description: 'packet missing data field',
    packet: { origin: '550e8400-e29b-41d4-a716-446655440000', target: '641c7fcb-d7dd-4a18-ab50-ce797192ed82' },
  },
  {
    description: 'packet missing origin field',
    packet: { target: '641c7fcb-d7dd-4a18-ab50-ce797192ed82', data: createUint8Array([1, 2, 3]) },
  },
  {
    description: 'packet missing target field',
    packet: { origin: '550e8400-e29b-41d4-a716-446655440000', data: createUint8Array([1, 2, 3]) },
  },
]
