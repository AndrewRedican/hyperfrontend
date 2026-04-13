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
import type { NoneTransportConfig, ReceiveHandler, TransportState } from './types'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Creates a passthrough (no security) transport adapter.
 *
 * The none transport provides the same interface as secure transports
 * but performs no transformation on messages. This enables consistent
 * handling in channel code regardless of security configuration.
 *
 * @param config - Configuration for the transport
 * @param config.target - Target window for postMessage
 * @param config.origin - Allowed origin for messages (defaults to '*')
 * @returns A security transport that passes through actions unchanged
 *
 * @example Using passthrough transport
 * ```typescript
 * const transport = createNoneTransport({ target: iframe.contentWindow })
 *
 * transport.onReceive((action) => {
 *   console.log('Received:', action)
 * })
 *
 * transport.send({ type: 'test', data: 123 })
 * ```
 */
export function createNoneTransport(config: NoneTransportConfig): SecurityTransport {
  const { target, origin = '*' } = config

  const state: TransportState = {
    ready: true,
    stopped: false,
  }

  let receiveHandler: ReceiveHandler | null = null

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

    target.postMessage(action, origin)
  }

  /**
   * Register a handler for incoming actions.
   *
   * The handler receives actions unchanged (no decryption).
   *
   * @param handler - Callback invoked with received actions
   */
  const onReceive = (handler: ReceiveHandler): void => {
    receiveHandler = handler
  }

  /**
   * Process a received message.
   *
   * This method should be called by the broker's message router
   * when a message is received for a channel using this transport.
   *
   * @param action - The received action
   */
  const handleReceive = (action: unknown): void => {
    if (state.stopped || !receiveHandler) {
      return
    }

    receiveHandler(action)
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
    return state.ready
  }

  /**
   * Get the transport's protocol version.
   *
   * @returns Always returns 'none'
   */
  const getProtocol = (): SecurityProtocolVersion => {
    return 'none'
  }

  return freeze(<SecurityTransport & { /** Processes incoming actions (for testing) */ handleReceive: (action: unknown) => void }>{
    send,
    onReceive,
    stop,
    resume,
    isReady,
    getProtocol,
    /** @internal */
    handleReceive,
  })
}
