/**
 * Shared test fixtures for data encryption and decryption tests.
 * These fixtures are used by both Node.js and browser test suites.
 */

import type { SerializedData, JSONString } from '../model'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

export interface EncryptionTestCase {
  description: string
  data: SerializedData
  password: string
}

const createMockSerializedData = <T>(message: T, suffix = ''): SerializedData<T> => ({
  pid: `test-pid-${suffix}`,
  id: `test-id-${suffix}`,
  sequence: 1,
  key: `test-key-${suffix}`,
  message: <JSONString<T>>stringify(message),
  schema: { type: 'object' },
  schemaHash: `test-hash-${suffix}`,
})

/**
 * Test cases for data encryption/decryption.
 * Each case includes a description, data to encrypt, and a password.
 */
export const encryptionTestCases: EncryptionTestCase[] = [
  {
    description: 'simple object with string and number',
    data: createMockSerializedData({ message: 'hello', count: 42 }, '1'),
    password: 'test-password-123',
  },
  {
    description: 'nested object with multiple levels',
    data: createMockSerializedData(
      {
        user: {
          name: 'Alice',
          profile: {
            age: 30,
            settings: {
              theme: 'dark',
              notifications: true,
            },
          },
        },
      },
      '2'
    ),
    password: 'secure-password-456',
  },
  {
    description: 'array of objects',
    data: createMockSerializedData(
      [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
        { id: 3, name: 'Item 3' },
      ],
      '3'
    ),
    password: 'array-password-789',
  },
  {
    description: 'empty object',
    data: createMockSerializedData({}, '4'),
    password: 'empty-password',
  },
  {
    description: 'object with various data types',
    data: createMockSerializedData(
      {
        string: 'text',
        number: 123,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        nested: { key: 'value' },
      },
      '5'
    ),
    password: 'complex-password',
  },
]

/**
 * Invalid test cases for error handling validation.
 */
export const invalidEncryptionTestCases = [
  {
    description: 'null data',
    data: null,
    password: 'valid-password',
  },
  {
    description: 'undefined data',
    data: undefined,
    password: 'valid-password',
  },
  {
    description: 'empty password',
    data: { test: 'data' },
    password: '',
  },
  {
    description: 'non-string password',
    data: { test: 'data' },
    password: <string>(<unknown>123),
  },
]
