/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PacketEncryption, PacketDecryption } from '../packet/model'
import type { PacketObfuscation, PacketDeobfuscation } from '../packet/model'

export type { PacketObfuscation, PacketDeobfuscation }

export interface EncryptionSuite<T = any> {
  packetEncryption: PacketEncryption<T>
  packetDecryption: PacketDecryption<T>
}

export interface ObfuscationSuite {
  packetObfuscation: PacketObfuscation
  packetDeobfuscation: PacketDeobfuscation
}

export interface SecuritySuite<T = any> extends EncryptionSuite<T>, ObfuscationSuite {}
