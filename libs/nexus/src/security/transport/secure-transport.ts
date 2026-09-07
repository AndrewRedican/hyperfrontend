/**
 * Secure transport implementation.
 *
 * A transport adapter that drives a security wire pipeline to exchange
 * sealed frames between two windows. The transport owns the session's hello
 * exchange and its confirmation: once started it posts the local hello, and
 * again at every retry interval, until the counterpart confirms the session;
 * it feeds the counterpart's hello to the protocol; and it treats the first
 * frame that authenticates under the session keys as that confirmation.
 *
 * @module security/transport/secure-transport
 */

import type { Schema } from '@hyperfrontend/json-utils'
import type {
  SecurityErrorCode,
  SecurityPacket,
  SecurityPacketData,
  SecurityPacketDrop,
  SecurityProtocolVersion,
  SecurityTransport,
  SecurityTransportError,
} from '../../types/security'
import type { SecureTransportConfig } from './types'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { clearInterval, clearTimeout, setInterval, setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { uuidV4 } from '@hyperfrontend/random-generator-utils'
import { ACTION_TYPES } from '../../constants/action-types'
import { readProtocolErrorCode } from '../errors'

// magic: SHA-256 hash of the serialized empty schema ('{}').
const EMPTY_SCHEMA_HASH = '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a'

// why: Actions are schemaless at the transport layer, so every envelope carries the permissive empty schema and its hash.
const EMPTY_SCHEMA: Schema = freeze({})

/** The part of an opened action the transport inspects before delivering it */
interface TypedAction {
  /** The action type, when the payload carries one */
  readonly type?: unknown
}

/**
 * Creates a secure transport adapter driving a security wire pipeline.
 *
 * Outbound actions are wrapped in a data envelope and sealed by the
 * provider's pipeline; the resulting frames are posted to the counterpart
 * window. Inbound hello frames key the session, and inbound sealed frames
 * are opened and delivered to `onAction` as plain actions. The first inbound
 * frame that authenticates confirms the session and fires `onConfirmed`; if
 * none does before the confirmation deadline, or the session can never be
 * keyed, the transport reports the failure through `onError` and `onFailed`.
 *
 * @param config - Configuration for the transport
 * @param config.protocol - Security protocol version (e.g. 'v3' or 'v4')
 * @param config.provider - Security implementation building the wire pipeline
 * @param config.label - Human-readable label surfaced in protocol diagnostics
 * @param config.target - Counterpart window that receives outbound frames
 * @param config.getOrigin - Returns the origin currently pinned to the channel, or null before pinning
 * @param config.originId - UUID identifying the local endpoint
 * @param config.targetId - UUID identifying the counterpart endpoint
 * @param config.role - This endpoint's handshake role
 * @param config.helloRetryMs - Interval between hello retries until the counterpart confirms
 * @param config.confirmTimeoutMs - How long the counterpart has to confirm after `start`
 * @param config.onAction - Receives each opened action
 * @param config.onError - Optional handler for security failures
 * @param config.onConfirmed - Optional handler invoked once the counterpart's first frame authenticates
 * @param config.onFailed - Optional handler invoked when the session can no longer be confirmed
 * @returns A security transport that seals and opens actions
 *
 * @example Using a v4 transport
 * ```typescript
 * import { logger } from '@hyperfrontend/logging'
 * import { createChannel } from '@hyperfrontend/network-protocol/browser/channel'
 * import { createProtocol } from '@hyperfrontend/network-protocol/browser/v4'
 *
 * const transport = createSecureTransport({
 *   protocol: 'v4',
 *   provider: { createChannel, protocolProvider: createProtocol(logger, 'shared-secret') },
 *   label: 'checkout-feature',
 *   target: iframe.contentWindow,
 *   getOrigin: () => 'https://feature.example.com',
 *   originId: hostId,
 *   targetId: featureId,
 *   role: 'initiator',
 *   helloRetryMs: 500,
 *   confirmTimeoutMs: 10_000,
 *   onAction: (action) => console.log('Received:', action),
 *   onConfirmed: () => console.log('Counterpart confirmed the session'),
 * })
 *
 * transport.start()
 * transport.send({ type: 'test', data: 123 })
 * ```
 */
export function createSecureTransport(config: SecureTransportConfig): SecurityTransport {
  const {
    protocol,
    provider,
    label,
    target,
    getOrigin,
    originId,
    targetId,
    role,
    helloRetryMs,
    confirmTimeoutMs,
    onAction,
    onError,
    onConfirmed,
    onFailed,
  } = config

  const pid = uuidV4()
  let sequence = 0
  let started = false
  let confirmed = false
  let disposed = false
  let helloTimer: ReturnType<typeof setInterval> | null = null
  let deadlineTimer: ReturnType<typeof setTimeout> | null = null

  const clearTimers = (): void => {
    if (helloTimer !== null) {
      clearInterval(helloTimer)
      helloTimer = null
    }
    if (deadlineTimer !== null) {
      clearTimeout(deadlineTimer)
      deadlineTimer = null
    }
  }

  /**
   * Resolve the origin outbound frames are posted to.
   *
   * @returns The pinned origin, or `'*'` before pinning and for opaque origins
   */
  const targetOrigin = (): string => {
    const origin = getOrigin()
    // why: Sends target the pinned origin once learned; '*' covers the pre-pin window and opaque ('null') origins, which postMessage cannot target.
    return origin === null || origin === 'null' ? '*' : origin
  }

  /**
   * Report a failure the transport survives.
   *
   * @param error - The failure to report
   */
  const report = (error: SecurityTransportError): void => {
    if (onError) {
      onError(error)
    }
  }

  /**
   * Report a failure the session cannot recover from.
   *
   * @param code - The failure's error code
   * @param message - Human-readable description of the failure
   * @param cause - The underlying error, when there is one
   */
  const fail = (code: SecurityErrorCode, message: string, cause?: unknown): void => {
    if (disposed) {
      return
    }
    clearTimers()
    const error: SecurityTransportError = freeze({ message, code, ...(cause !== undefined && { cause }) })
    report(error)
    if (onFailed) {
      onFailed(error)
    }
  }

  /**
   * Post a sealed frame to the counterpart window.
   *
   * @param frame - The sealed frame to post
   */
  const sendPacket = (frame: Uint8Array): void => {
    // why: A frame the pipeline sealed was accepted before dispose; a channel's last words (a close acknowledgement, a destroy) must still reach the counterpart.
    target.postMessage(frame, targetOrigin(), [frame.buffer])
  }

  /**
   * Deliver an opened inbound packet's action to the handler.
   *
   * @param packet - The opened packet containing the transported action
   */
  const receivePacket = (packet: SecurityPacket): void => {
    if (disposed) {
      return
    }
    // why: A frame that authenticated under the session keys proves the counterpart derived them, whatever the frame carries.
    if (!confirmed) {
      confirmed = true
      clearTimers()
      if (onConfirmed) {
        onConfirmed()
      }
    }
    const action = packet.data.message as TypedAction | null
    if (action?.type === ACTION_TYPES.SECURITY_CONFIRMED) {
      return
    }
    onAction(packet.data.message)
  }

  /**
   * Surface a packet the wire pipeline discarded.
   *
   * The pipeline drops asynchronously, after `send`/`receive` have already
   * returned, so this is the only path by which a lost packet becomes
   * visible to the channel's subscribers.
   *
   * @param drop - The discarded packet and the stage that rejected it
   */
  const notifyDrop = (drop: SecurityPacketDrop): void => {
    if (disposed) {
      return
    }
    const code = readProtocolErrorCode(drop.cause) ?? 'transport-error'
    const message = `Dropped ${drop.direction} packet at ${drop.stage}: ${drop.reason}`
    // why: Session material that cannot key the session never will; the deadline would report the same failure later.
    if (code === 'invalid-session') {
      fail(code, message, drop.cause)
      return
    }
    report(freeze({ message, code, ...(drop.cause !== undefined && { cause: drop.cause }) }))
  }

  const channel = provider.createChannel(label, {
    send: sendPacket,
    receive: receivePacket,
    protocolProvider: provider.protocolProvider,
    session: { protocol, role, localId: originId, peerId: targetId },
    onDrop: notifyDrop,
  })

  /**
   * Wrap an action in the wire data envelope.
   *
   * @param action - The action to transport
   * @returns The data envelope carrying the action at `message`
   */
  const createEnvelope = (action: unknown): SecurityPacketData => {
    sequence += 1
    return freeze({
      pid,
      id: uuidV4(),
      sequence,
      message: action,
      schema: EMPTY_SCHEMA,
      schemaHash: EMPTY_SCHEMA_HASH,
    })
  }

  /**
   * Send an action through the security pipeline.
   *
   * The action is sealed once the session is keyed and posted to the
   * counterpart window as a `Uint8Array`.
   *
   * @param action - The action to send
   */
  const send = (action: unknown): void => {
    if (disposed) {
      return
    }
    try {
      channel.send(originId, targetId, createEnvelope(action))
    } catch (error) {
      report(freeze({ message: (error as Error).message, code: 'transport-error', cause: error }))
    }
  }

  /**
   * Post the local hello unless the counterpart has already confirmed.
   */
  const postHello = (): void => {
    channel.hello().then(
      (frame) => {
        // why: The hello is posted by copy: the protocol hands out the same frame on every call, and a transferred buffer would leave the retries empty.
        if (!disposed && !confirmed) {
          target.postMessage(frame, targetOrigin())
        }
      },
      (error: unknown) => fail('transport-error', `Cannot produce the '${protocol}' session hello: ${(error as Error).message}`, error)
    )
  }

  /**
   * Start the hello exchange and arm the confirmation deadline.
   */
  const start = (): void => {
    if (started || disposed) {
      return
    }
    started = true
    postHello()
    helloTimer = setInterval(postHello, helloRetryMs)
    deadlineTimer = setTimeout(
      () => fail('security-unconfirmed', `The counterpart did not confirm the '${protocol}' session within ${confirmTimeoutMs}ms.`),
      confirmTimeoutMs
    )
  }

  /**
   * Feed a received wire frame into the pipeline.
   *
   * A hello keys the session and is answered with a sealed confirmation;
   * any other frame is opened, and the opened action surfaces through
   * `onAction`. Frames the pipeline rejects are reported through `onError`.
   *
   * @param frame - The raw wire frame to process
   */
  const receive = (frame: Uint8Array): void => {
    if (disposed) {
      return
    }
    if (!channel.isHello(frame)) {
      channel.receive(frame)
      return
    }
    const outcome = channel.acceptHello(frame)
    if (outcome === 'accepted') {
      send({ type: ACTION_TYPES.SECURITY_CONFIRMED, senderId: originId })
      return
    }
    if (outcome === 'rejected') {
      report(freeze({ message: `Rejected a hello that differs from the one keying the '${protocol}' session.`, code: 'hello-rejected' }))
    }
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
   * Release the transport: clears its timers and refuses further work.
   *
   * Frames already inside the seal stage still leave once sealed; nothing
   * sent, received, or reported after this point is acted on.
   */
  const dispose = (): void => {
    if (disposed) {
      return
    }
    disposed = true
    clearTimers()
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
    start,
    stop,
    resume,
    dispose,
    getProtocol,
  })
}
