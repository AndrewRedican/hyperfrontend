import { getType } from '@hyperfrontend/data-utils'

export function isValidName(name: string): boolean {
  return getType(name) === 'string' && name.length >= 1
}
