import type { Protocol, ProtocolProvider } from './model'
import { logger } from '@hyperfrontend/logging'
import { packetEncryption, packetDecryption, packetObfuscation, packetDeobfuscation } from '../packet/creators/mocks'
import { sender } from '../sender/creators/mocks'
import { receiver } from '../receiver/creators/mocks'

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

export const protocolProvider: ProtocolProvider = () => protocol
