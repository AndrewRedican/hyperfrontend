/**
 * None transport implementation.
 *
 * A passthrough transport for the `'none'` protocol: actions are posted
 * to the counterpart window as they are, and inbound payloads are handed
 * to the action handler unchanged.
 *
 * @module security/transport/none-transport
 */

import type { SecurityTransport, SecurityProtocolVersion } from '../../types/security'
import type { NoneTransportConfig, TransportState } from './types'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Creates a passthrough transport for the `'none'` protocol.
 *
 * @param config - Configuration for the transport
 * @param config.target - Counterpart window that receives outbound traffic
 * @param config.getOrigin - Returns the origin currently pinned to the channel, or null before pinning
 * @param config.onAction - Receives each action delivered by the transport
 * @returns A security transport that passes actions through unchanged
 *
 * @example Creating a plaintext transport
 * ```typescript
 * const transport = createNoneTransport({
 *   target: iframe.contentWindow,
 *   getOrigin: () => 'https://feature.example.com',
 *   onAction: (action) => handleAction(action),
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
   * Post an action to the counterpart window unchanged.
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
   * Hand an inbound payload to the action handler unchanged.
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
   * Nothing to start: the plaintext transport has no session.
   */
  const start = (): void => {
    // why: The plaintext transport has no session to start.
  }

  /**
   * Stop processing (backpressure control).
   */
  const stop = (): void => {
    state.stopped = true
  }

  /**
   * Resume processing after stop.
   */
  const resume = (): void => {
    state.stopped = false
  }

  /**
   * Nothing to release: the plaintext transport holds no timers or pipeline.
   */
  const dispose = (): void => {
    // why: The plaintext transport holds no timers or pipeline to release.
  }

  /**
   * Get the transport's protocol version.
   *
   * @returns Always `'none'`
   */
  const getProtocol = (): SecurityProtocolVersion => {
    return 'none'
  }

  return freeze({
    send,
    receive,
    start,
    stop,
    resume,
    dispose,
    getProtocol,
  })
}
