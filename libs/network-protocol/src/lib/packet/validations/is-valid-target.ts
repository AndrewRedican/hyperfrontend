import { getType } from '@hyperfrontend/data-utils'
import { isUuidV4 } from '@hyperfrontend/random-generator-utils'

export function isValidTarget(target: unknown): boolean {
  return getType(target) === 'string' && (<string>target).length === 36 && isUuidV4(<string>target)
}
