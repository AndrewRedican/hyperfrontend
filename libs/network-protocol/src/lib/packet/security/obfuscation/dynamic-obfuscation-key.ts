import type { ObfuscationSuite, PacketObfuscation, PacketDeobfuscation } from '../../../security/model'

/**
 * Creates a factory for dynamic key-based obfuscation suites.
 *
 * This factory accepts packet obfuscation and deobfuscation functions and returns a function
 * that creates obfuscation suites with dynamic key providers. The key provider is evaluated
 * at the time of each obfuscation/deobfuscation operation, allowing for keys to change dynamically.
 *
 * @param {PacketObfuscation} obfuscatePacket - Function to obfuscate a packet with a password
 * @param {PacketDeobfuscation} deobfuscatePacket - Function to deobfuscate data with a password
 * @returns {(provider: () => string) => ObfuscationSuite} A factory function that accepts a key provider and returns an obfuscation suite
 */
export function createDynamicKeyObfuscationFactory(obfuscatePacket: PacketObfuscation, deobfuscatePacket: PacketDeobfuscation) {
  return (provider: () => string): ObfuscationSuite => {
    const packetObfuscationFn: ObfuscationSuite['packetObfuscation'] = (packet) => obfuscatePacket(packet, provider())
    const packetDeobfuscationFn: ObfuscationSuite['packetDeobfuscation'] = (packet) => deobfuscatePacket(packet, provider())
    return Object.freeze({ packetObfuscation: packetObfuscationFn, packetDeobfuscation: packetDeobfuscationFn })
  }
}
