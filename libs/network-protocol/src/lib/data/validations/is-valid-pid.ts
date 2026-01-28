import { getType } from '@hyperfrontend/data-utils'
import { isUuidV4 } from '@hyperfrontend/random-generator-utils'

export function isValidPid(pid: unknown): boolean {
  return getType(pid) === 'string' && (<string>pid).length === 36 && isUuidV4(<string>pid)
}
