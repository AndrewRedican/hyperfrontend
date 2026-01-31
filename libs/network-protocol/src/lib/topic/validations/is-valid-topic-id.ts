import { getType } from '@hyperfrontend/data-utils'
import { isUuidV4 } from '@hyperfrontend/random-generator-utils'

/**
 * Validates whether the provided value is a valid topic identifier.
 * The topic ID must be a 36-character UUID v4 string.
 *
 * @param topic - The value to validate as a topic ID
 * @returns True if the value is a valid UUID v4 string, false otherwise
 */
export function isValidTopicId(topic: unknown): boolean {
  return getType(topic) === 'string' && (<string>topic).length === 36 && isUuidV4(<string>topic)
}
