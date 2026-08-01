/**
 * None transport implementation.
 *
 * A passthrough transport that performs no encryption or obfuscation.
 * Actions are sent and received unchanged via postMessage.
 *
 * This transport is used when:
 * - Security is explicitly disabled
 * - No security protocols are available
 * - Backward compatibility with non-security-aware channels
 *
 * @module security/transport/none-transport
 */

import type { SecurityTransport, SecurityProtocolVersion } from '../../types/security'
import type { NoneTransportConfig, TransportState } from './types'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Creates a passthrough (no security) transport adapter.
 *
 * The none transport provides the same interface as secure transports
 * but performs no transformation on messages. This enables consistent
 * handling in channel code regardless of security configuration.
 *
 * @param config - Configuration for the transport
 * @param config.target - Counterpart window that receives outbound traffic
 * @param config.getOrigin - Returns the origin currently pinned to the channel, or null before pinning
 * @param config.onAction - Receives each action delivered by the transport
 * @returns A security transport that passes through actions unchanged
 *
 * @example Using passthrough transport
 * ```typescript
 * const transport = createNoneTransport({
 *   target: iframe.contentWindow,
 *   getOrigin: () => 'https://feature.example.com',
 *   onAction: (action) => console.log('Received:', action),
 * })
 *
 * transport.send({ type: 'test', data: 123 })
 * ```
 */
export function createNoneTransport(config: NoneTransportConfig): SecurityTransport {
  const { target, getOrigin, onAction } = config

  const state: TransportState = {
    stopped: false,
  }

  /**
   * Send an action through the transport (passthrough).
   *
   * For the none transport, the action is sent unchanged via postMessage.
   *
   * @param action - The action to send
   */
  const send = (action: unknown): void => {
    if (state.stopped) {
      return
    }

    const origin = getOrigin()
    // why: Sends target the pinned origin once learned; '*' covers the pre-pin window and opaque ('null') origins, which postMessage cannot target.
    target.postMessage(action, origin === null || origin === 'null' ? '*' : origin)
  }

  /**
   * Process a received payload.
   *
   * The payload is delivered to the `onAction` handler unchanged
   * (no decryption).
   *
   * @param packet - The received payload
   */
  const receive = (packet: Uint8Array): void => {
    if (state.stopped) {
      return
    }

    onAction(packet)
  }

  /**
   * Stop processing messages (backpressure control).
   *
   * For the none transport, this is a no-op since there is no
   * internal queue. Messages are silently dropped when stopped.
   */
  const stop = (): void => {
    state.stopped = true
  }

  /**
   * Resume processing messages.
   */
  const resume = (): void => {
    state.stopped = false
  }

  /**
   * Check if the transport is ready for message exchange.
   *
   * The none transport is always ready since it requires no initialization.
   *
   * @returns Always returns true
   */
  const isReady = (): boolean => {
    return true
  }

  /**
   * Get the transport's protocol version.
   *
   * @returns Always returns 'none'
   */
  const getProtocol = (): SecurityProtocolVersion => {
    return 'none'
  }

  return freeze({
    send,
    receive,
    stop,
    resume,
    isReady,
    getProtocol,
  })
}
