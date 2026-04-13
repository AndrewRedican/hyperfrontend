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
export type * from '../../lib/protocol/model'
export type * from '../../lib/protocol/validations/is-valid-protocol.model'
export * from '../../lib/protocol/validations/is-valid-name'
export * from '../../lib/protocol/validations/is-valid-protocol-provider'
export * from '../../lib/protocol/validations/is-valid-protocol'
export * from '../../lib/protocol/validations/is-valid-receive-fn'
export * from '../../lib/protocol/validations/is-valid-send-fn'
export * from '../../lib/protocol/creators/create-provider-protocol-store'
export * from '../../lib/protocol/v2/creators/create-static-key-protocol-factory'
