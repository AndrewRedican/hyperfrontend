/**
 * Node.js-side packet encryption, serialization, and obfuscation with dynamic key support.
 *
 * @module @hyperfrontend/network-protocol/node/packet
 */
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
export type {
  ObfuscatedPacket,
  PacketBase,
  UnencryptedPacket,
  UnserializedEncryptedPacket,
  SerializedEncryptedPacket,
  UnobfuscatedPacket,
  Packet,
  PacketEncrypter,
  PacketDecrypter,
  PacketObfuscater,
  PacketDeobfuscater,
  PacketEncryption,
  PacketDecryption,
  PacketSerialization,
  PacketDeserialization,
  PacketObfuscation,
  PacketDeobfuscation,
} from '../../lib/packet/model'
export type { ValidUnobfuscatedPacketBaseResult } from '../../lib/packet/validations/is-valid-unobfuscated-packet-base.model'
export { isValidObfuscatedPacket } from '../../lib/packet/validations/is-valid-obfuscated-packet'
export { isValidOrigin } from '../../lib/packet/validations/is-valid-origin'
export { isValidSerializedEncryptedPacket } from '../../lib/packet/validations/is-valid-serialized-encrypted-packet'
export { isValidTarget } from '../../lib/packet/validations/is-valid-target'
export { isValidUnencryptedPacket } from '../../lib/packet/validations/is-valid-unencrypted-packet'
export { isValidUnobfuscatedPacketBase } from '../../lib/packet/validations/is-valid-unobfuscated-packet-base'
export { isValidUnserializedEncryptedPacket } from '../../lib/packet/validations/is-valid-unserialized-encrypted-packet'
export { createDynamicKeyEncryptionFactory } from '../../lib/packet/security/encryption/dynamic-encryption-key'
export { createDynamicKeyObfuscationFactory } from '../../lib/packet/security/obfuscation/dynamic-obfuscation-key'
export { isValidRefreshRate } from '../../lib/packet/security/obfuscation/is-valid-refresh-rate'
