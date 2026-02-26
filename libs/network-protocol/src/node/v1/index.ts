import { getTimeBasedPassword, getTimeBasedPasswords } from '@hyperfrontend/cryptography/node'
import { encryptPacket, decryptPacket } from '../packet'
import { createPacketObfuscator } from '../../lib/packet/security/obfuscation/create-obfuscator'
import { createPacketDeobfuscator } from '../../lib/packet/security/obfuscation/create-deobfuscator'
import { createDynamicKeyEncryptionFactory } from '../../lib/packet/security/encryption/dynamic-encryption-key'
import { createFirstMessageHandler } from '../../lib/packet/security/encryption/create-first-message-handler'
import { createTimeIntervalObfuscationFactory } from '../../lib/packet/security/obfuscation/time-interval-obfuscation-factory'
import { createProtocolFactory } from '../../lib/protocol/v1/creators/create-protocol-factory'
import { encrypt, decrypt } from '@hyperfrontend/cryptography/node'

const obfuscatePacket = createPacketObfuscator(encrypt)
const deobfuscatePacket = createPacketDeobfuscator(decrypt)

// Text encoding/decoding for first message handler (Node.js)
const textEncoder = (text: string): Uint8Array => Buffer.from(text, 'utf-8')
const textDecoder = (data: Uint8Array): string => Buffer.from(data).toString('utf-8')
const firstMessageHandler = createFirstMessageHandler(textEncoder, textDecoder)

const createDynamicKeyEncryption = createDynamicKeyEncryptionFactory(encryptPacket, decryptPacket, firstMessageHandler)

const createTimeIntervalObfuscation = createTimeIntervalObfuscationFactory(
  obfuscatePacket,
  deobfuscatePacket,
  getTimeBasedPassword,
  getTimeBasedPasswords
)

/**
 * Creates a protocol with dynamic key encryption.
 * Keys are exchanged in-band via packet.data.key during the handshake.
 *
 * **First Message Handling:**
 * The first message (before key exchange) is sent with obfuscation only.
 * When received, the key is extracted and used for subsequent encrypted messages.
 */
export const createProtocol = createProtocolFactory(createDynamicKeyEncryption, createTimeIntervalObfuscation)

export type * from '../../lib/protocol/model'
export type * from '../../lib/protocol/validations/is-valid-protocol.model'
export * from '../../lib/protocol/validations/is-valid-name'
export * from '../../lib/protocol/validations/is-valid-protocol-provider'
export * from '../../lib/protocol/validations/is-valid-protocol'
export * from '../../lib/protocol/validations/is-valid-receive-fn'
export * from '../../lib/protocol/validations/is-valid-send-fn'
export * from '../../lib/protocol/creators/create-provider-protocol-store'
export * from '../../lib/protocol/v1/creators/create-protocol-factory'
