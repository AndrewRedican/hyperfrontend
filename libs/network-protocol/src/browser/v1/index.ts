import { getTimeBasedPassword, getTimeBasedPasswords } from '@hyperfrontend/cryptography/browser'
import { encryptPacket, decryptPacket } from '../packet'
import { createPacketObfuscator } from '../../lib/packet/security/obfuscation/create-obfuscator'
import { createPacketDeobfuscator } from '../../lib/packet/security/obfuscation/create-deobfuscator'
import { createDynamicKeyEncryptionFactory } from '../../lib/packet/security/encryption/dynamic-encryption-key'
import { createDynamicKeyObfuscationFactory } from '../../lib/packet/security/obfuscation/dynamic-obfuscation-key'
import { createTimeIntervalObfuscationFactory } from '../../lib/packet/security/obfuscation/time-interval-obfuscation-factory'
import { createProtocolFactory } from '../../lib/protocol/v1/creators/create-protocol-factory'
import { encrypt, decrypt } from '@hyperfrontend/cryptography/browser'

const obfuscatePacket = createPacketObfuscator(encrypt)
const deobfuscatePacket = createPacketDeobfuscator(decrypt)

const createDynamicKeyEncryption = createDynamicKeyEncryptionFactory(encryptPacket, decryptPacket)

const createTimeIntervalObfuscation = createTimeIntervalObfuscationFactory(
  obfuscatePacket,
  deobfuscatePacket,
  getTimeBasedPassword,
  getTimeBasedPasswords
)

export const createProtocol = createProtocolFactory(createDynamicKeyEncryption, createTimeIntervalObfuscation)

export type * from '../../lib/protocol/v1/model'
export * from '../../lib/protocol/v1/validations'
export * from '../../lib/protocol/v1/creators/create-provider-protocol-store'
