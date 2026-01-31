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
 */
export function isValidTopic(topic: unknown): boolean {
  const tp = <Topic>topic
  return getType(topic) === 'object' && 'name' in tp && 'id' in tp && isValidName(tp.name) && isValidTopicId(tp.id)
}
