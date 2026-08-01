import type { ChannelHandle, IMessage } from '@hyperfrontend/nexus'
import type { EventEmitter } from './event-emitter'
import type { PeerOrigin, RequestOptions, RequestPeer } from './request'
import type { FeatureContract } from './types'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { promiseReject } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { isControlType } from './control'
import { assertSendPayload, buildActionIndex, checkReceivePayload } from './payload-validation'
import { createRequestPeer } from './request'
import { createContractCompat } from './version-compat'

// note: The protocol spine both ends of a session share — how a channel is configured, which channel events reach consumers unchanged, and how a delivered message is judged. The host and hostee lifecycles differ in role (watchdog versus pulse, mount versus document), not here, so this wiring is stated once and each side supplies only its own control handling.

/**
 * Nexus channel settings for one side of a feature session.
 */
export interface ChannelSettingsInput {
  /** Security settings returned by `registerSecurity`, or `undefined` when unsecured. */
  security: Record<string, unknown> | undefined
  /** Milliseconds allowed for the wire handshake, or `undefined` for the nexus default. */
  connectTimeoutMs: number | undefined
  /** Origin to pin every send to; omitted when the counterpart's origin is not known before the handshake. */
  origin?: string
}

/**
 * Assembles the nexus channel settings a feature session connects with.
 *
 * Every features channel carries the contract-compatibility rule; security,
 * the origin pin, and the handshake deadline are applied only when the side
 * configured them, so an absent option leaves the nexus default in force.
 *
 * @param input - The security settings, handshake deadline, and origin pin to apply.
 * @returns The settings object to hand to `broker.addChannel`.
 *
 * @example Configuring an origin-pinned, time-bounded channel
 * ```typescript
 * broker.addChannel('feature-1', target, buildChannelSettings({ security, connectTimeoutMs: 5000, origin: 'https://clock.example.com' }))
 * ```
 */
export function buildChannelSettings(input: ChannelSettingsInput): Record<string, unknown> {
  return {
    contractCompat: createContractCompat(),
    ...input.security,
    ...(input.origin ? { origin: input.origin } : {}),
    ...(input.connectTimeoutMs !== undefined ? { connectTimeoutMs: input.connectTimeoutMs } : {}),
  }
}

/**
 * Forwards the channel lifecycle events both sides surface identically.
 *
 * `open`, `close`, and `connect-timeout` stay with each side, which resets
 * different state and (host-side) may keep the mount alive across a reload.
 *
 * @param channel - The channel to subscribe to.
 * @param emitter - The subscription registry backing the side's `on`.
 *
 * @example Forwarding the shared lifecycle events to consumers
 * ```typescript
 * wireChannelEvents(channel, emitter)
 * ```
 */
export function wireChannelEvents(channel: ChannelHandle, emitter: EventEmitter): void {
  // why: The closing notice arrives while the channel still delivers, giving the app its flush window for unsaved work before the close completes.
  channel.on('closing', (data) => emitter.emit('closing', data))
  channel.on('deny', (data) => emitter.emit('error', data))
  channel.on('invalid', (data) => emitter.emit('error', data))
}

/**
 * Injected settings for {@link createMessagingCore}.
 */
export interface MessagingCoreInput {
  /** Which side of the channel this core speaks for; stamps request envelopes. */
  origin: PeerOrigin
  /** This side's own combined contract, indexed once for send and receive validation. */
  contract: FeatureContract
  /** The subscription registry backing the side's `on`. */
  emitter: EventEmitter
  /** The reason phrase completing `Cannot send request '<type>': <reason>.` when no channel is connected. */
  disconnectedReason: string
  /**
   * Resolves the channel currently carrying the session.
   *
   * Read on every send rather than captured, so a host handle whose channel is
   * replaced across open/close cycles keeps one request peer throughout.
   *
   * @returns The live channel, or `null` when none is connected.
   */
  channel(): ChannelHandle | null
}

/**
 * The contract-validated messaging surface shared by both sides of a session.
 */
export interface MessagingCore {
  /** The correlated request/response peer riding the control plane. */
  requests: RequestPeer
  /**
   * Validates an outgoing payload against this side's own `emitted` schemas, then sends it.
   *
   * @param type - The action type to send.
   * @param data - The payload to send.
   * @throws {Error} When the payload does not satisfy the action's schema; the throw lands in the sender's frame.
   */
  send(type: string, data?: unknown): void
  /**
   * Sends a correlated request and resolves with the counterpart's response.
   *
   * @param type - Request type the counterpart answers.
   * @param data - Optional payload for the request.
   * @param options - Per-request settings such as `timeoutMs`.
   * @returns A promise settling with the response, rejected when no channel is connected.
   */
  request(type: string, data?: unknown, options?: RequestOptions): Promise<unknown>
  /**
   * Builds the handler routing one delivered message.
   *
   * Control traffic goes to the side's own handler first and falls through to
   * the request peer when unclaimed, so reserved types never reach consumer
   * handlers. Product traffic is validated against this side's own `accepted`
   * schemas and dropped on failure.
   *
   * @param onControl - Handles one control message; returns `true` when it consumed the message.
   * @returns The handler to pass to `channel.onMessage`.
   */
  createRouter(onControl: (type: string, data: unknown) => boolean): (message: IMessage) => void
}

/**
 * Builds the messaging surface one side of a feature session speaks through.
 *
 * The core outlives any individual channel: it reads the live channel on every
 * send, so a host that reopens keeps a single request peer and a single action
 * index across the whole handle's life.
 *
 * @param input - The side's origin, contract, emitter, channel accessor, and disconnected-request phrasing.
 * @returns The {@link MessagingCore} for this side.
 *
 * @example Wiring the hostee side of a session
 * ```typescript
 * const messaging = createMessagingCore({ origin: 'feature', contract, emitter, disconnectedReason: 'the feature is not connected to a host', channel: () => channel })
 * channel.onMessage(messaging.createRouter((type, data) => type === ControlType.Present && applyPresent(data)))
 * ```
 */
export function createMessagingCore(input: MessagingCoreInput): MessagingCore {
  const requests = createRequestPeer(input.origin, (type, data) => input.channel()?.send(type, data))
  // why: Indexed once per handle so every send/receive validates with a map lookup instead of rescanning the contract.
  const actions = buildActionIndex(input.contract)

  return {
    requests,
    send: (type: string, data?: unknown) => {
      // why: Validated before the channel touches it so a schema violation throws in the sender's frame instead of surfacing on the counterpart.
      assertSendPayload(actions, type, data)
      input.channel()?.send(type, data)
    },
    request: (type: string, data?: unknown, options?: RequestOptions) =>
      input.channel()
        ? requests.request(type, data, options)
        : promiseReject(createError(`Cannot send request '${type}': ${input.disconnectedReason}.`)),
    createRouter:
      (onControl: (type: string, data: unknown) => boolean) =>
      (message: IMessage): void => {
        // why: Control traffic (heartbeat, presentation, request/response envelopes) is SDK-internal; forwarding it would leak reserved __hf: types into consumer handlers.
        if (isControlType(message.type)) {
          if (!onControl(message.type, message.data)) {
            requests.dispatch(message.type, message.data)
          }
          return
        }
        // why: Invalid payloads are dropped before consumer handlers run; the error event carries the schema errors so the side can diagnose its misbehaving counterpart.
        const result = checkReceivePayload(actions, message.type, message.data)
        if (!result.valid) {
          input.emitter.emit('error', { reason: 'invalid-payload', type: message.type, errors: result.errors })
          return
        }
        input.emitter.emit(message.type, message.data)
      },
  }
}
