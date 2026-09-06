import type { Channel } from '../model'
import { getType } from '@hyperfrontend/data-utils'

/**
 * Checks that a value has the shape of a channel: send, receive, and hello-exchange functions
 * and an outbound and inbound pipeline each exposing a queue with a size and stop/resume
 * controls.
 *
 * @param channel - The value to check
 * @returns True when the value has the shape of a `Channel`
 *
 * @example Guarding a channel before storing it
 * ```typescript
 * isValidChannel(createChannel('comms', options))
 * // => true
 * ```
 */
export function isValidChannel(channel: unknown): boolean {
  const ch = channel as Channel
  return (
    getType(ch) === 'object' &&
    'send' in ch &&
    'receive' in ch &&
    'outbound' in ch &&
    'inbound' in ch &&
    getType(ch.send) === 'function' &&
    getType(ch.receive) === 'function' &&
    getType(ch.hello) === 'function' &&
    getType(ch.isHello) === 'function' &&
    getType(ch.acceptHello) === 'function' &&
    getType(ch.outbound) === 'object' &&
    getType(ch.inbound) === 'object' &&
    getType(ch.outbound.queue) === 'object' &&
    getType(ch.inbound.queue) === 'object' &&
    getType(ch.outbound.queue.size) === 'number' &&
    getType(ch.inbound.queue.size) === 'number' &&
    getType(ch.outbound.stop) === 'function' &&
    getType(ch.outbound.resume) === 'function' &&
    getType(ch.inbound.stop) === 'function' &&
    getType(ch.inbound.resume) === 'function'
  )
}
