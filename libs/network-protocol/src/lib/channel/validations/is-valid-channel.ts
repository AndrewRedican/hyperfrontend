import type { Channel } from '../model'
import { getType } from '@hyperfrontend/data-utils'

/**
 * Validates whether a channel meets the required structure with send/receive methods and inbound/outbound queues.
 *
 * @param channel - The channel object to validate
 * @returns True if the channel is valid, false otherwise
 *
 * @example Validating channel structure
 * ```typescript
 * isValidChannel(channel) // => true
 * isValidChannel({}) // => false
 * ```
 */
export function isValidChannel(channel: unknown): boolean {
  const ch = <Channel>channel
  return (
    getType(ch) === 'object' &&
    'send' in ch &&
    'receive' in ch &&
    'outbound' in ch &&
    'inbound' in ch &&
    getType(ch.send) === 'function' &&
    getType(ch.receive) === 'function' &&
    getType(ch.outbound) === 'object' &&
    getType(ch.inbound) === 'object' &&
    getType(ch.outbound.encryptionQueue) === 'object' &&
    getType(ch.outbound.serializationQueue) === 'object' &&
    getType(ch.outbound.obfuscationQueue) === 'object' &&
    getType(ch.inbound.deobfuscationQueue) === 'object' &&
    getType(ch.inbound.deserializationQueue) === 'object' &&
    getType(ch.inbound.decryptionQueue) === 'object' &&
    getType(ch.outbound.encryptionQueue.size) === 'number' &&
    getType(ch.outbound.serializationQueue.size) === 'number' &&
    getType(ch.outbound.obfuscationQueue.size) === 'number' &&
    getType(ch.inbound.deobfuscationQueue.size) === 'number' &&
    getType(ch.inbound.deserializationQueue.size) === 'number' &&
    getType(ch.inbound.decryptionQueue.size) === 'number' &&
    getType(ch.outbound.stop) === 'function' &&
    getType(ch.outbound.resume) === 'function' &&
    getType(ch.inbound.stop) === 'function' &&
    getType(ch.inbound.resume) === 'function'
  )
}
