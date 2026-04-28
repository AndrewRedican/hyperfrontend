/**
 * Secure transport implementation.
 *
 * A transport adapter that wraps network-protocol's encryption and
 * obfuscation pipeline to provide secure message exchange.
 *
 * This transport is used when the negotiated protocol is 'v1' or 'v2':
 * - v1: Obfuscation-first handshake with dynamic key exchange
 * - v2: Pre-shared key (PSK) handshake with dynamic key rotation
 *
 * @module security/transport/secure-transport
 */

import type { SecurityTransport, SecurityProtocolVersion } from '../../types/security'
import type { SecureTransportConfig, ReceiveHandler, TransportState } from './types'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSecurityErrorEventData } from '../errors'

/**
 * Internal test hook exposed on the secure-transport instance.
 * Lets tests deliver a raw inbound packet without traversing postMessage.
 */
type SecureTransportInternals = {
  /** @internal */
  handleReceive: (packet: Uint8Array) => void
}

/**
 * Protocol interface from network-protocol.
 *
 * This is a minimal subset of the network-protocol Protocol interface
 * that secure transport requires. The full Protocol type is not imported
 * to avoid a hard dependency on network-protocol.
 *
 * @internal
 */
interface NetworkProtocol {
  /** Sends encrypted data from origin to target */
  send: (origin: string, target: string, data: unknown) => void
  /** Receives and decrypts an incoming packet */
  receive: (packet: Uint8Array) => void
}

/**
 * ProtocolProvider function signature from network-protocol.
 *
 * Creates a NetworkProtocol instance with packet send/receive handlers.
 *
 * @internal
 */
type NetworkProtocolProvider = (
  sendPacket: (packet: Uint8Array) => void,
  receivePacket: (packet: DecryptedPacket) => void
) => NetworkProtocol

/**
 * Decrypted packet data structure from the network protocol.
 *
 * @internal
 */
interface DecryptedPacket {
  /** Sender identifier for the decrypted message */
  origin: string
  /** Recipient identifier for the decrypted message */
  target: string
  /** Decrypted action payload */
  data: unknown
}

/**
 * Creates a secure transport adapter wrapping network-protocol.
 *
 * The secure transport encrypts outgoing actions and decrypts incoming
 * messages using the configured protocol provider. Messages are sent
 * as Uint8Array via postMessage.
 *
 * @param config - Configuration for the transport
 * @param config.protocol - Security protocol version ('v1' or 'v2')
 * @param config.provider - Protocol provider from network-protocol
 * @param config.sharedKey - Pre-shared key (required for v2)
 * @param config.refreshRate - Key rotation interval in minutes
 * @param config.target - Target window for postMessage
 * @param config.origin - Allowed origin for messages (defaults to '*')
 * @returns A security transport that encrypts/decrypts actions
 *
 * @example Using encrypted transport
 * ```typescript
 * import { createProtocol } from '@hyperfrontend/network-protocol/browser/v2'
 *
 * const provider = createProtocol(logger, 'shared-secret', 60)
 * const transport = createSecureTransport({
 *   protocol: 'v2',
 *   provider,
 *   target: iframe.contentWindow
 * })
 *
 * transport.onReceive((action) => {
 *   console.log('Received and decrypted:', action)
 * })
 *
 * transport.send({ type: 'test', data: 123 })
 * ```
 */
export function createSecureTransport(config: SecureTransportConfig): SecurityTransport {
  const { protocol, provider, target, origin = '*', onError } = config

  if (!provider) {
    throw createError(`SecureTransport requires a protocol provider for ${protocol}`)
  }

  const state: TransportState = {
    ready: false,
    stopped: false,
  }

  let receiveHandler: ReceiveHandler | null = null
  let networkProtocol: NetworkProtocol | null = null

  /**
   * Notify error handler of security failures.
   *
   * @param error - The error that occurred
   */
  const notifyError = (error: unknown): void => {
    if (onError) {
      onError(createSecurityErrorEventData(error))
    }
  }

  /**
   * Send a packet to the target window.
   * This is called by the network-protocol after encryption/obfuscation.
   *
   * @param packet - The encrypted packet to send
   */
  const sendPacket = (packet: Uint8Array): void => {
    if (state.stopped) {
      return
    }

    target.postMessage(packet, origin, [packet.buffer])
  }

  /**
   * Receive a decrypted packet from the network-protocol.
   * This is called after deobfuscation/decryption completes.
   *
   * @param packet - The decrypted packet containing message data
   */
  const receivePacket = (packet: DecryptedPacket): void => {
    if (state.stopped || !receiveHandler) {
      return
    }

    receiveHandler(packet.data)
  }

  /**
   * Initialize the network protocol.
   */
  const initializeProtocol = (): void => {
    const providerFn = <NetworkProtocolProvider>provider
    networkProtocol = providerFn(sendPacket, receivePacket)
    state.ready = true
  }

  /**
   * Send an action through the security pipeline.
   *
   * The action is encrypted and obfuscated before being sent via postMessage.
   *
   * @param action - The action to send
   */
  const send = (action: unknown): void => {
    if (state.stopped) {
      return
    }

    if (!networkProtocol) {
      initializeProtocol()
    }

    const currentProtocol = networkProtocol
    if (currentProtocol) {
      try {
        currentProtocol.send('nexus', 'channel', action)
      } catch (error) {
        notifyError(error)
      }
    }
  }

  /**
   * Register a handler for decrypted incoming actions.
   *
   * @param handler - Callback invoked with decrypted actions
   */
  const onReceive = (handler: ReceiveHandler): void => {
    receiveHandler = handler

    if (!networkProtocol) {
      initializeProtocol()
    }
  }

  /**
   * Process a received encrypted message.
   *
   * This method should be called by the broker's message router
   * when an encrypted message (Uint8Array) is received.
   * Errors during decryption are caught and forwarded to the error handler.
   *
   * @param packet - The encrypted packet to decrypt
   */
  const handleReceive = (packet: Uint8Array): void => {
    if (state.stopped || !networkProtocol) {
      return
    }

    try {
      networkProtocol.receive(packet)
    } catch (error) {
      notifyError(error)
    }
  }

  /**
   * Stop processing messages (backpressure control).
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
   * Check if the transport is ready for secure message exchange.
   *
   * @returns True if the protocol is initialized and ready
   */
  const isReady = (): boolean => {
    return state.ready
  }

  /**
   * Get the transport's protocol version.
   *
   * @returns The configured protocol version ('v1' or 'v2')
   */
  const getProtocol = (): SecurityProtocolVersion => {
    return protocol
  }

  return freeze(<SecurityTransport & SecureTransportInternals>{
    send,
    onReceive,
    stop,
    resume,
    isReady,
    getProtocol,
    handleReceive,
  })
}
