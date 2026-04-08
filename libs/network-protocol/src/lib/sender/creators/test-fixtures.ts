import type { Logger } from '@hyperfrontend/logging'

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
 * Test labels for sender identification.
 */
export const testLabels = {
  sender1: 'test-sender-1',
  sender2: 'test-sender-2',
}

/**
 * Test messages for data creation.
 */
export const testMessages = {
  simple: { message: 'test message' },
  nested: { value: 42, nested: { key: 'value' } },
  minimal: { count: 1 },
}

/**
 * Mock logger for testing.
 *
 * @returns A mock logger with no-op implementations for all log methods
 *
 * @example
 * ```typescript
 * const logger = createMockLogger()
 * logger.info('test') // does nothing
 * ```
 */
export const createMockLogger = (): Logger => ({
  debug: () => void 0,
  info: () => void 0,
  warn: () => void 0,
  error: () => void 0,
  log: () => void 0,
  setLogLevel: () => void 0,
  getLogLevel: () => <const>'info',
})
