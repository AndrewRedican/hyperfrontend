import { getType } from '@hyperfrontend/data-utils'

export function isValidSerializedData(data: unknown): boolean {
  return getType(data) === 'string' && (<string>data).length > 0
}
