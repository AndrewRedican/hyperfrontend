import { encrypt, decrypt, createHash } from '@hyperfrontend/cryptography/browser'
import { createDataFactory } from '../../lib/data/creators/create-data-factory'
import { createDataDecrypter } from '../../lib/data/security/create-decrypter'
import { createDataEncrypter } from '../../lib/data/security/create-encrypter'

export const encryptData = createDataEncrypter(encrypt)
export const decryptData = createDataDecrypter(decrypt)
export const createData = createDataFactory(createHash)
export type * from '../../lib/data/model'
export * from '../../lib/data/validations/is-valid-id'
export * from '../../lib/data/validations/is-valid-message'
export * from '../../lib/data/validations/is-valid-pid'
export * from '../../lib/data/validations/is-valid-schema-hash'
export * from '../../lib/data/validations/is-valid-schema-sequence'
export * from '../../lib/data/validations/is-valid-schema'
export * from '../../lib/data/validations/is-valid-serialized-data'
export * from '../../lib/data/validations/is-valid-unencrypted-data'
export * from '../../lib/data/validations/is-valid-unserialized-data'
export * from '../../lib/data/creators/get-schema'
