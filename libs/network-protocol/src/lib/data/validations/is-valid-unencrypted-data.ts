import type { Data } from '../model'
import { getType } from '@hyperfrontend/data-utils'
import { isValidPid } from './is-valid-pid'
import { isValidId } from './is-valid-id'
import { isValidSequence } from './is-valid-schema-sequence'
import { isValidMessage } from './is-valid-message'
import { isValidSchema } from './is-valid-schema'
import { isValidSchemaHash } from './is-valid-schema-hash'

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
