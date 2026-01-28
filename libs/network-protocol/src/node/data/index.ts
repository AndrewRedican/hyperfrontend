import { encrypt, decrypt, createHash } from '@hyperfrontend/cryptography/node'
import { createDataEncrypter } from '../../lib/data/security/create-encrypter'
import { createDataDecrypter } from '../../lib/data/security/create-decrypter'
import { createDataFactory } from '../../lib/data/creators/create-data-factory'

export const encryptData = createDataEncrypter(encrypt)
export const decryptData = createDataDecrypter(decrypt)
export const createData = createDataFactory(createHash)

export type * from '../../lib/data/model'
export * from '../../lib/data/validations'
export * from '../../lib/data/creators/get-schema'
