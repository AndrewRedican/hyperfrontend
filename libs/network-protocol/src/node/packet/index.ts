import { encrypt, decrypt } from '@hyperfrontend/cryptography/node'
import { uint8ArrayToBase64, base64ToUint8Array } from '@hyperfrontend/string-utils/node'
import { createDeserializedEncryptedPacketCreator } from '../../lib/packet/creators/create-deserialized-encrypted-packet-creator'
import { createSerializedEncryptedPacketCreator } from '../../lib/packet/creators/create-serialized-encrypted-packet-creator'
import { createPacketDecrypter } from '../../lib/packet/security/encryption/create-decrypter'
import { createPacketEncrypter } from '../../lib/packet/security/encryption/create-encrypter'
import { createPacketDeobfuscator } from '../../lib/packet/security/obfuscation/create-deobfuscator'
import { createPacketObfuscator } from '../../lib/packet/security/obfuscation/create-obfuscator'
import { encryptData, decryptData } from '../data'

export const createSerializedEncryptedPacket = createSerializedEncryptedPacketCreator(uint8ArrayToBase64)
export const createDeserializedEncryptedPacket = createDeserializedEncryptedPacketCreator(base64ToUint8Array)
export const encryptPacket = createPacketEncrypter(encryptData)
export const decryptPacket = createPacketDecrypter(decryptData)
export const obfuscatePacket = createPacketObfuscator(encrypt)
export const deobfuscatePacket = createPacketDeobfuscator(decrypt)
export type * from '../../lib/packet/model'
export type * from '../../lib/packet/validations/is-valid-unobfuscated-packet-base.model'
export * from '../../lib/packet/validations/is-valid-obfuscated-packet'
export * from '../../lib/packet/validations/is-valid-origin'
export * from '../../lib/packet/validations/is-valid-serialized-encrypted-packet'
export * from '../../lib/packet/validations/is-valid-target'
export * from '../../lib/packet/validations/is-valid-unencrypted-packet'
export * from '../../lib/packet/validations/is-valid-unobfuscated-packet-base'
export * from '../../lib/packet/validations/is-valid-unserialized-encrypted-packet'
export * from '../../lib/packet/security/encryption/dynamic-encryption-key'
export * from '../../lib/packet/security/obfuscation/dynamic-obfuscation-key'
export * from '../../lib/packet/security/obfuscation/is-valid-refresh-rate'
