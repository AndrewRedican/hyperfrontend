import { getType } from '@hyperfrontend/data-utils'

export function isValidReceiveFn(receive: unknown) {
  return getType(receive) === 'function'
}
