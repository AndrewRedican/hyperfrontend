/**
 * V1 protocol for browser with dynamic key exchange and time-based obfuscation.
 *
 * @module @hyperfrontend/network-protocol/browser/v1
 */
import { getTimeBasedPassword, getTimeBasedPasswords, encrypt, decrypt } from '@hyperfrontend/cryptography/browser'
import { createTextDecoder, createTextEncoder } from '@hyperfrontend/immutable-api-utils/built-in-copy/encoding'
import { createFirstMessageHandler } from '../../lib/packet/security/encryption/create-first-message-handler'
import { createDynamicKeyEncryptionFactory } from '../../lib/packet/security/encryption/dynamic-encryption-key'
import { createPacketDeobfuscator } from '../../lib/packet/security/obfuscation/create-deobfuscator'
import { createPacketObfuscator } from '../../lib/packet/security/obfuscation/create-obfuscator'
import { createTimeIntervalObfuscationFactory } from '../../lib/packet/security/obfuscation/time-interval-obfuscation-factory'
import { createProtocolFactory } from '../../lib/protocol/v1/creators/create-protocol-factory'
import { encryptPacket, decryptPacket } from '../packet'

const obfuscatePacket = createPacketObfuscator(encrypt)
const deobfuscatePacket = createPacketDeobfuscator(decrypt)

const textEncoder = (text: string): Uint8Array => createTextEncoder().encode(text)
const textDecoder = (data: Uint8Array): string => createTextDecoder().decode(data)
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
export type { ProtocolProviderEntry, ProtocolProviderStore } from '../../lib/protocol/model'
export type { ValidProtocolResult } from '../../lib/protocol/validations/is-valid-protocol.model'
export { isValidName } from '../../lib/protocol/validations/is-valid-name'
export { isValidProtocolProvider } from '../../lib/protocol/validations/is-valid-protocol-provider'
export { isValidProtocol } from '../../lib/protocol/validations/is-valid-protocol'
export { isValidReceiveFn } from '../../lib/protocol/validations/is-valid-receive-fn'
export { isValidSendFn } from '../../lib/protocol/validations/is-valid-send-fn'
export { createProtocolProviderStore } from '../../lib/protocol/creators/create-provider-protocol-store'
export { createObfuscatedHandshakeProtocolFactory, createProtocolFactory } from '../../lib/protocol/v1/creators/create-protocol-factory'
