import type { Protocol, ProtocolProvider } from '../../../channel/model'
import { logger } from '@hyperfrontend/logging'
import { packetEncryption, packetDecryption, packetObfuscation, packetDeobfuscation } from '../../../packet/creators/mocks'
import { receiver } from '../../../receiver/creators/mocks'
import { sender } from '../../../sender/creators/mocks'

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
 */
export const protocolProvider: ProtocolProvider = () => protocol
