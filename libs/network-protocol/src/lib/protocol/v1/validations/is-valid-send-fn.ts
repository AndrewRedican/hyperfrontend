import { getType } from '@hyperfrontend/data-utils'

export function isValidSendFn(send: unknown) {
  return getType(send) === 'function'
}
