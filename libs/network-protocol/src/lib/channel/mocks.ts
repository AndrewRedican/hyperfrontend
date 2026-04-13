import type { Protocol, ProtocolProvider } from './model'
import { logger } from '@hyperfrontend/logging'
import { packetEncryption, packetDecryption, packetObfuscation, packetDeobfuscation } from '../packet/creators/mocks'
import { receiver } from '../receiver/creators/mocks'
import { sender } from '../sender/creators/mocks'

export const send = sender

export const receive = receiver

export const protocol: Protocol = {
  packetEncryption,
  packetDecryption,
  packetObfuscation,
  packetDeobfuscation,
  send,
  receive,
  getLogger: () => ({ ...logger }),
}

/**
 * Provides a mock protocol instance for testing.
 *
 * @returns A mock Protocol instance
 *
 * @example Getting a mock protocol
 * ```typescript
 * const protocol = protocolProvider(sendFn, receiveFn)
 * // => { packetEncryption, packetDecryption, send, receive, ... }
 * ```
 */
export const protocolProvider: ProtocolProvider = () => protocol
