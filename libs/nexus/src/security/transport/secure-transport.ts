/**
 * Secure transport implementation.
 *
 * A transport adapter that drives a security wire pipeline (encryption,
 * serialization, and obfuscation) to provide secure message exchange
 * between two windows.
 *
 * This transport is used when the negotiated protocol is 'v1' or 'v2':
 * - v1: Time-interval obfuscation; peers remain on the protocol's base key
 * - v2: Pre-shared key (PSK) handshake; encrypted from the first message
 *
 * @module security/transport/secure-transport
 */

import type { Schema } from '@hyperfrontend/json-utils'
import type { SecurityTransport, SecurityProtocolVersion, SecurityPacket, SecurityPacketData } from '../../types/security'
import type { SecureTransportConfig } from './types'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { uuidV4 } from '@hyperfrontend/random-generator-utils'
import { createSecurityErrorEventData } from '../errors'

// magic: SHA-256 hash of the serialized empty schema ('{}').
const EMPTY_SCHEMA_HASH = '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a'

// why: Actions are schemaless at the transport layer, so every envelope carries the permissive empty schema and its hash.
const EMPTY_SCHEMA: Schema = freeze({})

/**
 * Creates a secure transport adapter driving a security wire pipeline.
 *
 * Outbound actions are wrapped in a data envelope and pushed through the
 * provider's encryption pipeline; the resulting ciphertext bytes are posted
 * to the counterpart window. Inbound wire bytes are pushed through the
 * decryption pipeline and delivered to `onAction` as plain actions.
 *
 * @param config - Configuration for the transport
 * @param config.protocol - Security protocol version (e.g. 'v1' or 'v2')
 * @param config.provider - Security implementation building the wire pipeline
 * @param config.label - Human-readable label surfaced in protocol diagnostics
 * @param config.target - Counterpart window that receives outbound ciphertext
 * @param config.getOrigin - Returns the origin currently pinned to the channel, or null before pinning
 * @param config.originId - UUID identifying the local endpoint
 * @param config.targetId - UUID identifying the counterpart endpoint
 * @param config.onAction - Receives each decrypted action
 * @param config.onError - Optional handler for security failures
 * @returns A security transport that encrypts/decrypts actions
 *
 * @example Using encrypted transport
 * ```typescript
 * import { logger } from '@hyperfrontend/logging'
 * import { createChannel } from '@hyperfrontend/network-protocol/browser/channel'
 * import { createProtocol } from '@hyperfrontend/network-protocol/browser/v2'
 *
 * const transport = createSecureTransport({
 *   protocol: 'v2',
 *   provider: { createChannel, protocolProvider: createProtocol(logger, 'shared-secret') },
 *   label: 'checkout-feature',
 *   target: iframe.contentWindow,
 *   getOrigin: () => 'https://feature.example.com',
 *   originId: hostId,
 *   targetId: featureId,
 *   onAction: (action) => console.log('Received and decrypted:', action),
 * })
 *
 * transport.send({ type: 'test', data: 123 })
 * ```
 */
export function createSecureTransport(config: SecureTransportConfig): SecurityTransport {
  const { protocol, provider, label, target, getOrigin, originId, targetId, onAction, onError } = config

  const pid = uuidV4()
  let sequence = 0

  /**
   * Notify the error handler of security failures.
   *
   * @param error - The error that occurred
   */
  const notifyError = (error: unknown): void => {
    if (onError) {
      onError(createSecurityErrorEventData(error))
    }
  }

  /**
   * Post fully processed ciphertext bytes to the counterpart window.
   *
   * @param packet - The obfuscated ciphertext to post
   */
  const sendPacket = (packet: Uint8Array): void => {
    const origin = getOrigin()
    // why: Sends target the pinned origin once learned; '*' covers the pre-pin window and opaque ('null') origins, which postMessage cannot target.
    target.postMessage(packet, origin === null || origin === 'null' ? '*' : origin, [packet.buffer])
  }

  /**
   * Deliver a decrypted inbound packet's action to the handler.
   *
   * @param packet - The decrypted packet containing the transported action
   */
  const receivePacket = (packet: SecurityPacket): void => {
    onAction(packet.data.message)
  }

  const channel = provider.createChannel(label, sendPacket, receivePacket, provider.protocolProvider)

  /**
   * Wrap an action in the wire data envelope.
   *
   * @param action - The action to transport
   * @returns The data envelope carrying the action at `message`
   */
  const createEnvelope = (action: unknown): SecurityPacketData => {
    sequence += 1
    // why: An empty reply key keeps both peers on the protocol's base key (v2's pre-shared key; v1's obfuscated plaintext); per-message reply keys would desynchronize the peers' captured keys under bidirectional traffic.
    return freeze({
      pid,
      id: uuidV4(),
      sequence,
      key: '',
      message: action,
      schema: EMPTY_SCHEMA,
      schemaHash: EMPTY_SCHEMA_HASH,
    })
  }

  /**
   * Send an action through the security pipeline.
   *
   * The action is encrypted and obfuscated before being posted to the
   * counterpart window as a `Uint8Array`.
   *
   * @param action - The action to send
   */
  const send = (action: unknown): void => {
    try {
      channel.send(originId, targetId, createEnvelope(action))
    } catch (error) {
      notifyError(error)
    }
  }

  /**
   * Feed a received wire payload into the decryption pipeline.
   *
   * Decrypted actions surface through the `onAction` handler; payloads that
   * fail decryption are logged and dropped by the pipeline.
   *
   * @param packet - The raw wire payload to process
   */
  const receive = (packet: Uint8Array): void => {
    channel.receive(packet)
  }

  /**
   * Stop processing messages (backpressure control).
   *
   * Actions sent while stopped are queued inside the pipeline and flushed
   * on resume.
   */
  const stop = (): void => {
    channel.stop()
  }

  /**
   * Resume processing messages.
   */
  const resume = (): void => {
    channel.resume()
  }

  /**
   * Check if the transport can protect product traffic right now.
   *
   * The pipeline's full protection is in force from construction: 'v2'
   * encrypts with its pre-shared key immediately, and 'v1' obfuscates on
   * the protocol's base key because the envelope never offers a reply key.
   * Gating readiness on inbound traffic would deadlock two peers that
   * both queue product messages until their transports report ready.
   *
   * @returns Always true; the pipeline protects traffic from construction
   */
  const isReady = (): boolean => {
    return true
  }

  /**
   * Get the transport's protocol version.
   *
   * @returns The configured protocol version
   */
  const getProtocol = (): SecurityProtocolVersion => {
    return protocol
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
