import type { ReceivePacketFn } from '../../receiver/model'

/**
 * Mock receiver function that does nothing.
 *
 * @returns void
 *
 * @example Using the mock receiver
 * ```typescript
 * const handlePacket = receiver
 * handlePacket(packet) // does nothing
 * ```
 */
export const receiver: ReceivePacketFn = () => void 0
