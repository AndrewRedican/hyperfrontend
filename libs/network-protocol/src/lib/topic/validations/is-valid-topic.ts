import type { Topic } from '../model'
import { getType } from '@hyperfrontend/data-utils'
import { isValidName } from './is-valid-name'
import { isValidTopicId } from './is-valid-topic-id'

/**
 * Validates whether the provided value is a valid topic object.
 * A topic must have both a valid name and a valid topic ID.
 *
 * @param topic - The value to validate as a topic
 * @returns True if the value is a valid topic object, false otherwise
 *
 * @example Validating a topic object
 * ```typescript
 * isValidTopic({ name: 'notifications', id: '550e8400-e29b-41d4-a716-446655440000' })
 * // => true
 *
 * isValidTopic({ name: '' })
 * // => false
 * ```
 */
export function isValidTopic(topic: unknown): boolean {
  const tp = <Topic>topic
  return getType(topic) === 'object' && 'name' in tp && 'id' in tp && isValidName(tp.name) && isValidTopicId(tp.id)
}
