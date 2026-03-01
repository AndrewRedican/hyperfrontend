import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { isObject } from './_utils'

/**
 * Validates a channel contract structure.
 *
 * @param contract - The contract to validate
 * @throws {Error} Error if contract is invalid
 */
export function validateContract(contract: unknown): void {
  if (!contract) {
    throw new Error('Contract cannot be null or undefined')
  }

  if (!isObject(contract)) {
    throw new Error('Contract must be an object')
  }

  const c = <Record<string, unknown>>contract
  const emittedCount = isArray(c['emitted']) ? c['emitted'].length : 0
  const acceptedCount = isArray(c['accepted']) ? c['accepted'].length : 0

  if (emittedCount + acceptedCount === 0) {
    throw new Error('Contract must contain at least one accepted or emitted action')
  }

  // Validate that all action types are non-empty strings
  if (isArray(c['emitted'])) {
    for (const action of c['emitted']) {
      if (
        !action ||
        typeof (<Record<string, unknown>>action)['type'] !== 'string' ||
        (<Record<string, unknown>>action)['type'].toString().trim() === ''
      ) {
        throw new Error('Contract action types must be non-empty strings')
      }
    }
  }

  if (isArray(c['accepted'])) {
    for (const action of c['accepted']) {
      if (
        !action ||
        typeof (<Record<string, unknown>>action)['type'] !== 'string' ||
        (<Record<string, unknown>>action)['type'].toString().trim() === ''
      ) {
        throw new Error('Contract action types must be non-empty strings')
      }
    }
  }
}
