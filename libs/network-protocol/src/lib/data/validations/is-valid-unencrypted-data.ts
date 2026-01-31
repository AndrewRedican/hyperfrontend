import type { Data } from '../model'
import { getType } from '@hyperfrontend/data-utils'
import { isValidPid } from './is-valid-pid'
import { isValidId } from './is-valid-id'
import { isValidSequence } from './is-valid-schema-sequence'
import { isValidMessage } from './is-valid-message'
import { isValidSchema } from './is-valid-schema'
import { isValidSchemaHash } from './is-valid-schema-hash'

/**
 * Validates whether the provided value is valid unencrypted data.
 * Checks that all required data fields are present and valid, including PID, ID,
 * sequence number, message content, schema, and schema hash.
 *
 * @param data - The value to validate as unencrypted data
 * @returns True if the value is a valid unencrypted data object, false otherwise
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
