import type { Topic } from '../model'
import { getType } from '@hyperfrontend/data-utils'
import { isValidName } from './is-valid-name'
import { isValidTopicId } from './is-valid-topic-id'

export function isValidTopic(topic: unknown): boolean {
  const tp = <Topic>topic
  return getType(topic) === 'object' && 'name' in tp && 'id' in tp && isValidName(tp.name) && isValidTopicId(tp.id)
}
