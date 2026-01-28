export function isValidObfuscatedPacket(packet: unknown): boolean {
  return !!packet && packet instanceof Uint8Array
}
