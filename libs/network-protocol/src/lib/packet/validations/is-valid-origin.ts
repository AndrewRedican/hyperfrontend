import { getType } from '@hyperfrontend/data-utils'
import { isUuidV4 } from '@hyperfrontend/random-generator-utils'

export function isValidOrigin(origin: unknown): boolean {
  return getType(origin) === 'string' && (<string>origin).length === 36 && isUuidV4(<string>origin)
}
