import { getType } from '@hyperfrontend/data-utils'

export function isValidProtocolProvider(protocolProvider: unknown): boolean {
  return getType(protocolProvider) === 'function'
}
