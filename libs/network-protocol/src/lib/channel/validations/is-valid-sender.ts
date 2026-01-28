import { getType } from '@hyperfrontend/data-utils'

export function isValidSender(sender: unknown): boolean {
  return getType(sender) === 'function'
}
