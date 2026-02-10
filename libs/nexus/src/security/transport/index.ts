/**
 * Security transport adapter barrel export.
 *
 * @module security/transport
 */

export { createNoneTransport } from './none-transport'
export { createSecureTransport } from './secure-transport'
export { createSecurityTransport } from './factory'

export type {
  TransportState,
  ReceiveHandler,
  ErrorHandler,
  NoneTransportConfig,
  SecureTransportConfig,
  SecurityTransportFactory,
} from './types'
