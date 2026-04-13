import { getType } from '@hyperfrontend/data-utils'

/**
 * Validates whether the provided value is a valid protocol provider.
 * A protocol provider must be a function that creates protocol instances.
 *
 * @param protocolProvider - The value to validate as a protocol provider
 * @returns True if the value is a function, false otherwise
 *
 * @example Validating a protocol provider function
 * ```typescript
 * isValidProtocolProvider(() => protocol)
 * // => true
 *
 * isValidProtocolProvider('not-a-function')
 * // => false
 * ```
 */
export function isValidProtocolProvider(protocolProvider: unknown): boolean {
  return getType(protocolProvider) === 'function'
}
