/**
 * V4 protocol for Node.js: the session envelope keyed by an ephemeral P-256
 * agreement plus a stretched shared secret, so an outsider cannot join and a
 * key that leaks later cannot open past sessions.
 *
 * @module @hyperfrontend/network-protocol/node/v4
 */
import { createKeyAgreement, expandKey, getRandomValues, open, seal, stretchPassword } from '@hyperfrontend/cryptography/node'
import { uint8ArrayToUtf8String, utf8StringToUint8Array } from '@hyperfrontend/string-utils/node'
import { createV4ProtocolFactory } from '../../lib/protocol/session/create-v4-protocol-factory'

export const createProtocol = createV4ProtocolFactory({
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
export { createV4ProtocolFactory, isValidSharedKey, MIN_SHARED_KEY_LENGTH, V4 } from '../../lib/protocol/session/create-v4-protocol-factory'
export { isValidName } from '../../lib/protocol/validations/is-valid-name'
export { isValidProtocol } from '../../lib/protocol/validations/is-valid-protocol'
export { isValidProtocolProvider } from '../../lib/protocol/validations/is-valid-protocol-provider'
export { isValidReceiveFn } from '../../lib/protocol/validations/is-valid-receive-fn'
export { isValidSendFn } from '../../lib/protocol/validations/is-valid-send-fn'
