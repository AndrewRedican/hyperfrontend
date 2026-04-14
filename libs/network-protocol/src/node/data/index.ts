/**
 * Node.js-side data encryption, serialization, and schema validation utilities.
 *
 * @module @hyperfrontend/network-protocol/node/data
 */
import { encrypt, decrypt, createHash } from '@hyperfrontend/cryptography/node'
import { createDataFactory } from '../../lib/data/creators/create-data-factory'
import { createDataDecrypter } from '../../lib/data/security/create-decrypter'
import { createDataEncrypter } from '../../lib/data/security/create-encrypter'

export const encryptData = createDataEncrypter(encrypt)
export const decryptData = createDataDecrypter(decrypt)
export const createData = createDataFactory(createHash)
export type { JSONString, SerializedData, Data, DataCreater, SchemaCreater, DataEncrypter, DataDecrypter } from '../../lib/data/model'
export { isJSONString, asJSONString, parseJSONString, deserializeData, serializeData } from '../../lib/data/model'
export { isValidId } from '../../lib/data/validations/is-valid-id'
export { isValidMessage, type State } from '../../lib/data/validations/is-valid-message'
export { isValidPid } from '../../lib/data/validations/is-valid-pid'
export { isValidSchemaHash } from '../../lib/data/validations/is-valid-schema-hash'
export { isValidSequence } from '../../lib/data/validations/is-valid-schema-sequence'
export { isValidSchema } from '../../lib/data/validations/is-valid-schema'
export { isValidSerializedData } from '../../lib/data/validations/is-valid-serialized-data'
export { isValidUnencryptedData } from '../../lib/data/validations/is-valid-unencrypted-data'
export { isValidUnserializedData } from '../../lib/data/validations/is-valid-unserialized-data'
export { getSchema } from '../../lib/data/creators/get-schema'
