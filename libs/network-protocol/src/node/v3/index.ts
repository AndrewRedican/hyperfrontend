/**
 * V3 protocol for Node.js: a session-keyed envelope with no shared secret.
 *
 * Every session is keyed from an ephemeral P-256 agreement carried in the handshake, so a
 * party that only listens cannot read the traffic; the peer itself is not authenticated.
 *
 * @module @hyperfrontend/network-protocol/node/v3
 */
import { createKeyAgreement, expandKey, getRandomValues, open, seal, stretchPassword } from '@hyperfrontend/cryptography/node'
import { uint8ArrayToUtf8String, utf8StringToUint8Array } from '@hyperfrontend/string-utils/node'
import { createV3ProtocolFactory } from '../../lib/protocol/session/create-v3-protocol-factory'

export const createProtocol = createV3ProtocolFactory({
  getRandomValues,
  createKeyAgreement,
  stretchPassword,
  expandKey,
  seal,
  open,
  utf8Encode: utf8StringToUint8Array,
  utf8Decode: uint8ArrayToUtf8String,
})
export type { ProtocolProviderEntry, ProtocolProviderStore } from '../../lib/protocol/model'
export type { SessionCrypto } from '../../lib/protocol/session/model'
export type { ValidProtocolResult } from '../../lib/protocol/validations/is-valid-protocol.model'
export { createProtocolProviderStore } from '../../lib/protocol/creators/create-provider-protocol-store'
export { createV3ProtocolFactory, V3 } from '../../lib/protocol/session/create-v3-protocol-factory'
export { isValidName } from '../../lib/protocol/validations/is-valid-name'
export { isValidProtocol } from '../../lib/protocol/validations/is-valid-protocol'
export { isValidProtocolProvider } from '../../lib/protocol/validations/is-valid-protocol-provider'
export { isValidReceiveFn } from '../../lib/protocol/validations/is-valid-receive-fn'
export { isValidSendFn } from '../../lib/protocol/validations/is-valid-send-fn'
