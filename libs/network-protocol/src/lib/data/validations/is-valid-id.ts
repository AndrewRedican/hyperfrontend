import { getType } from '@hyperfrontend/data-utils'
import { isUuidV4 } from '@hyperfrontend/random-generator-utils'

export function isValidId(id: unknown): boolean {
  return getType(id) === 'string' && (<string>id).length === 36 && isUuidV4(<string>id)
}
