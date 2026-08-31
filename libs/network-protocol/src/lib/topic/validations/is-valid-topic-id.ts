import { getType } from '@hyperfrontend/data-utils'
import { isUuidV4 } from '@hyperfrontend/random-generator-utils'

/**
 * Validates whether the provided value is a valid topic identifier.
 * The topic ID must be a 36-character UUID v4 string.
 *
 * @param topic - The value to validate as a topic ID
 * @returns True if the value is a valid UUID v4 string, false otherwise
 *
 * @example Validating a topic identifier
 * ```typescript
 * isValidTopicId('550e8400-e29b-41d4-a716-446655440000')
 * // => true
 *
 * isValidTopicId('invalid-id')
 * // => false
 * ```
 */
export function isValidTopicId(topic: unknown): boolean {
  return getType(topic) === 'string' && (topic as string).length === 36 && isUuidV4(topic as string)
}
