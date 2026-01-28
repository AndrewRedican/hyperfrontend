import { getType } from '@hyperfrontend/data-utils'

export function isValidReceiver(receiver: unknown): boolean {
  return getType(receiver) === 'function'
}
