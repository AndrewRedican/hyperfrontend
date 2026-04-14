/**
 * V2 protocol for Node.js with pre-shared key handshake encryption.
 *
 * @module @hyperfrontend/network-protocol/node/v2
 */
import { getTimeBasedPassword, getTimeBasedPasswords } from '@hyperfrontend/cryptography/node'
import { encrypt, decrypt } from '@hyperfrontend/cryptography/node'
import { createPacketDeobfuscator } from '../../lib/packet/security/obfuscation/create-deobfuscator'
import { createPacketObfuscator } from '../../lib/packet/security/obfuscation/create-obfuscator'
import { createTimeIntervalObfuscationFactory } from '../../lib/packet/security/obfuscation/time-interval-obfuscation-factory'
import { createPSKHandshakeProtocolFactory } from '../../lib/protocol/v2/creators/create-static-key-protocol-factory'
import { encryptPacket, decryptPacket } from '../packet'

const obfuscatePacket = createPacketObfuscator(encrypt)
const deobfuscatePacket = createPacketDeobfuscator(decrypt)

const createTimeIntervalObfuscation = createTimeIntervalObfuscationFactory(
  obfuscatePacket,
  deobfuscatePacket,
  getTimeBasedPassword,
  getTimeBasedPasswords
)

/**
 * Creates a protocol with PSK handshake encryption.
 *
 * **V2 Protocol - PSK Handshake:**
 * - First message: Encrypted with pre-shared key (PSK)
 * - Key capture: Dynamic key extracted from `packet.data.key`
 * - Subsequent messages: Encrypted with dynamically captured keys
 *
 * **Security Benefit:**
 * Unlike V1, the encryption key is never exposed - even the first message is encrypted.
 * Both endpoints must share the PSK beforehand (out-of-band key exchange).
 *
 * All messages also use time-based obfuscation for an additional security layer.
 */
export const createProtocol = createPSKHandshakeProtocolFactory(encryptPacket, decryptPacket, createTimeIntervalObfuscation)
export type { ProtocolProviderEntry, ProtocolProviderStore } from '../../lib/protocol/model'
export type { ValidProtocolResult } from '../../lib/protocol/validations/is-valid-protocol.model'
export { isValidName } from '../../lib/protocol/validations/is-valid-name'
export { isValidProtocolProvider } from '../../lib/protocol/validations/is-valid-protocol-provider'
export { isValidProtocol } from '../../lib/protocol/validations/is-valid-protocol'
export { isValidReceiveFn } from '../../lib/protocol/validations/is-valid-receive-fn'
export { isValidSendFn } from '../../lib/protocol/validations/is-valid-send-fn'
export { createProtocolProviderStore } from '../../lib/protocol/creators/create-provider-protocol-store'
export { createPSKHandshakeProtocolFactory } from '../../lib/protocol/v2/creators/create-static-key-protocol-factory'
