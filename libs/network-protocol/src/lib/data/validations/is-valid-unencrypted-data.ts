import type { Data } from '../model'
import { getType } from '@hyperfrontend/data-utils'
import { isValidId } from './is-valid-id'
import { isValidMessage } from './is-valid-message'
import { isValidPid } from './is-valid-pid'
import { isValidSchema } from './is-valid-schema'
import { isValidSchemaHash } from './is-valid-schema-hash'
import { isValidSequence } from './is-valid-schema-sequence'

/**
 * Validates whether the provided value is valid unencrypted data.
 * Checks that all required data fields are present and valid, including PID, ID,
 * sequence number, message content, schema, and schema hash.
 *
 * @param data - The value to validate as unencrypted data
 * @returns True if the value is a valid unencrypted data object, false otherwise
 *
 * @example
 * ```typescript
 * isValidUnencryptedData({
 *   pid: '550e8400-e29b-41d4-a716-446655440000',
 *   id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
 *   sequence: 1,
 *   message: { action: 'update' },
 *   schema: { type: 'object' },
 *   schemaHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
 * })
 * // => true
 * ```
 */
export function isValidUnencryptedData(data: unknown): boolean {
  const d = <Data>data
  return (
    getType(d) === 'object' &&
    isValidPid(d.pid) &&
    isValidId(d.id) &&
    isValidSequence(d.sequence) &&
    isValidMessage(d.message) &&
    isValidSchema(d.schema) &&
    isValidSchemaHash(d.schemaHash)
  )
}
