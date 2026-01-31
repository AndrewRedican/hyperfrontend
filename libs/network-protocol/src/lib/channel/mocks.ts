import type { Protocol, ProtocolProvider } from './model'
import { logger } from '@hyperfrontend/logging'
import {
  encryptPacket as packetEncryption,
  decryptPacket as packetDecryption,
  obfuscatePacket as packetObfuscation,
  deobfuscatePacket as packetDeobfuscation,
} from '../packet/creators/mocks'
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
