/**
 * Browser-side data envelope factory and validators; the schema hash comes from the Web Crypto API.
 *
 * @module @hyperfrontend/network-protocol/browser/data
 */
import { createHash } from '@hyperfrontend/cryptography/browser'
import { createDataFactory } from '../../lib/data/creators/create-data-factory'

export const createData = createDataFactory(createHash)
export type { JSONString, SerializedData, Data, DataCreater, SchemaCreater } from '../../lib/data/model'
export type { State } from '../../lib/data/validations/is-valid-message'
export { getSchema } from '../../lib/data/creators/get-schema'
export { isJSONString, asJSONString, parseJSONString, deserializeData, serializeData } from '../../lib/data/model'
export { isValidId } from '../../lib/data/validations/is-valid-id'
export { isValidMessage } from '../../lib/data/validations/is-valid-message'
export { isValidPid } from '../../lib/data/validations/is-valid-pid'
export { isValidSchema } from '../../lib/data/validations/is-valid-schema'
export { isValidSchemaHash } from '../../lib/data/validations/is-valid-schema-hash'
export { isValidSequence } from '../../lib/data/validations/is-valid-schema-sequence'
export { isValidUnencryptedData } from '../../lib/data/validations/is-valid-unencrypted-data'
