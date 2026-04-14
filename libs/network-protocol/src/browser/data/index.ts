/**
 * Browser-side data encryption, serialization, and schema validation utilities.
 *
 * @module @hyperfrontend/network-protocol/browser/data
 */
import { encrypt, decrypt, createHash } from '@hyperfrontend/cryptography/browser'
import { createDataFactory } from '../../lib/data/creators/create-data-factory'
import { createDataDecrypter } from '../../lib/data/security/create-decrypter'
import { createDataEncrypter } from '../../lib/data/security/create-encrypter'

export const encryptData = createDataEncrypter(encrypt)
export const decryptData = createDataDecrypter(decrypt)
export const createData = createDataFactory(createHash)
export type { JSONString, SerializedData, Data, DataCreater, SchemaCreater, DataEncrypter, DataDecrypter } from '../../lib/data/model'
export type { State } from '../../lib/data/validations/is-valid-message'
export { getSchema } from '../../lib/data/creators/get-schema'
export { isJSONString, asJSONString, parseJSONString, deserializeData, serializeData } from '../../lib/data/model'
export { isValidId } from '../../lib/data/validations/is-valid-id'
export { isValidMessage } from '../../lib/data/validations/is-valid-message'
export { isValidPid } from '../../lib/data/validations/is-valid-pid'
export { isValidSchema } from '../../lib/data/validations/is-valid-schema'
export { isValidSchemaHash } from '../../lib/data/validations/is-valid-schema-hash'
export { isValidSequence } from '../../lib/data/validations/is-valid-schema-sequence'
export { isValidSerializedData } from '../../lib/data/validations/is-valid-serialized-data'
export { isValidUnencryptedData } from '../../lib/data/validations/is-valid-unencrypted-data'
export { isValidUnserializedData } from '../../lib/data/validations/is-valid-unserialized-data'
