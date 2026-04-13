import type { SendPacketFn } from '../../sender/model'

/**
 * Mock sender function that does nothing.
 *
 * @returns void
 *
 * @example Using the mock sender
 * ```typescript
 * const sendPacket = sender
 * sendPacket(packet) // does nothing
 * ```
 */
export const sender: SendPacketFn = () => void 0
