import { getType } from '@hyperfrontend/data-utils'
import { isUuidV4 } from '@hyperfrontend/random-generator-utils'

export function isValidTopicId(topic: unknown): boolean {
  return getType(topic) === 'string' && (<string>topic).length === 36 && isUuidV4(<string>topic)
}
