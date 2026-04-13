import type { PacketObfuscater, PacketDeobfuscater } from '../../../packet/model'
import type { ObfuscationSuite } from '../../../security/model'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Creates a factory for dynamic key-based obfuscation suites.
 *
 * This factory accepts packet obfuscation and deobfuscation functions and returns a function
 * that creates obfuscation suites with dynamic key providers. The key provider is evaluated
 * at the time of each obfuscation/deobfuscation operation, allowing for keys to change dynamically.
 *
 * @param {PacketObfuscater} obfuscatePacket - Function to obfuscate a packet with a password
 * @param {PacketDeobfuscater} deobfuscatePacket - Function to deobfuscate data with a password
 * @returns {(provider: () => string) => ObfuscationSuite} A factory function that accepts a key provider and returns an obfuscation suite
 *
 * @example Creating a dynamic key obfuscation suite
 * ```typescript
 * const factory = createDynamicKeyObfuscationFactory(obfuscatePacket, deobfuscatePacket)
 * let rotatingKey = 'initial-key'
 * const suite = factory(() => rotatingKey)
 * const obfuscated = await suite.packetObfuscation(packet)
 * ```
 */
export function createDynamicKeyObfuscationFactory(obfuscatePacket: PacketObfuscater, deobfuscatePacket: PacketDeobfuscater) {
  return (provider: () => string): ObfuscationSuite => {
    const packetObfuscationFn: ObfuscationSuite['packetObfuscation'] = (packet) => obfuscatePacket(packet, provider())
    const packetDeobfuscationFn: ObfuscationSuite['packetDeobfuscation'] = (packet) => deobfuscatePacket(packet, provider())
    return freeze({ packetObfuscation: packetObfuscationFn, packetDeobfuscation: packetDeobfuscationFn })
  }
}
