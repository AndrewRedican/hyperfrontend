export interface DataCreatorTestCase {
  description: string
  pid: string
  sequence: number
  message: unknown
}

/**
 * Test cases for data creation.
 * Each case includes a description, pid, sequence, and message.
 * Note: pid must be a valid UUID v4.
 */
export const dataCreatorTestCases: DataCreatorTestCase[] = [
  {
    description: 'simple message object',
    pid: '550e8400-e29b-41d4-a716-446655440000',
    sequence: 1,
    message: { type: 'hello', value: 'world' },
  },
  {
    description: 'nested message object',
    pid: '550e8400-e29b-41d4-a716-446655440001',
    sequence: 2,
    message: {
      user: {
        id: 'user-1',
        profile: {
          name: 'Alice',
          age: 30,
        },
      },
    },
  },
  {
    description: 'array message',
    pid: '550e8400-e29b-41d4-a716-446655440002',
    sequence: 3,
    message: [1, 2, 3, 4, 5],
  },
  {
    description: 'message with various types',
    pid: '550e8400-e29b-41d4-a716-446655440003',
    sequence: 4,
    message: {
      string: 'text',
      number: 42,
      boolean: true,
      array: [1, 2, 3],
      nested: { key: 'value' },
    },
  },
  {
    description: 'empty object message',
    pid: '550e8400-e29b-41d4-a716-446655440004',
    sequence: 5,
    message: {},
  },
]

/**
 * Invalid test cases for error handling validation.
 */
export const invalidDataCreatorTestCases = [
  {
    description: 'invalid pid (null)',
    pid: null,
    sequence: 1,
    message: { test: 'data' },
  },
  {
    description: 'invalid pid (empty string)',
    pid: '',
    sequence: 1,
    message: { test: 'data' },
  },
  {
    description: 'invalid pid (not UUID)',
    pid: 'not-a-uuid',
    sequence: 1,
    message: { test: 'data' },
  },
  {
    description: 'invalid sequence (negative)',
    pid: '550e8400-e29b-41d4-a716-446655440000',
    sequence: -1,
    message: { test: 'data' },
  },
  {
    description: 'invalid sequence (non-number)',
    pid: '550e8400-e29b-41d4-a716-446655440000',
    sequence: <number>(<unknown>'not-a-number'),
    message: { test: 'data' },
  },
  {
    description: 'invalid message (null)',
    pid: '550e8400-e29b-41d4-a716-446655440000',
    sequence: 1,
    message: null,
  },
  {
    description: 'invalid message (undefined)',
    pid: '550e8400-e29b-41d4-a716-446655440000',
    sequence: 1,
    message: undefined,
  },
]
