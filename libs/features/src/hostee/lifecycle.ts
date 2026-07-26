import type { BrokerHandle, ChannelHandle, IMessage } from '@hyperfrontend/nexus'
import type { EventEmitter } from '../shared/event-emitter'
import type { RequestOptions } from '../shared/request'
import type { FeatureContract, SecurityProtocol } from '../shared/types'
import type { FeatureHandle } from './types'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createPromise, promiseReject } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { isControlType } from '../shared/control'
import { assertSendPayload, buildActionIndex, checkReceivePayload } from '../shared/payload-validation'
import { createRequestPeer } from '../shared/request'
import { registerSecurity } from '../shared/security'
import { createContractCompat } from '../shared/version-compat'
import { createHeartbeatEmitter } from './heartbeat'
import { createSizeAnnouncer } from './sizing'

// note: The host connects from a parent window (embedded iframe) or an opener window (popup/standalone); a top-level document has neither.

/**
 * Resolves the window the host is expected to message the feature from.
 *
 * @param win - The feature's own window (`globalThis.window` in production).
 * @returns The parent or opener window, or `null` when running top-level.
 *
 * @example Resolving the host window
 * ```typescript
 * const hostWindow = resolveHostWindow(window)
 * ```
 */
export function resolveHostWindow(win: Window): Window | null {
  if (win.parent !== win) {
    return win.parent
  }
  if (win.opener) {
    return <Window>win.opener
  }
  return null
}

/**
 * Contract, timing, and security settings for the hostee handshake.
 */
export interface FeatureHandleSettings {
  /** Milliseconds the feature waits for the host before `ready()` rejects. */
  readyTimeoutMs?: number
  /** Security envelope to negotiate with the host; defaults to `none`. */
  protocol?: SecurityProtocol
  /** Pre-shared key used by the `v2` protocol. */
  sharedKey?: string
  /**
   * The feature's own combined contract. Its `emitted` schemas validate every
   * outgoing payload (an invalid send throws in the feature's frame) and its
   * `accepted` schemas validate every incoming payload (an invalid message is
   * dropped and surfaced as an `error` event).
   */
  contract: FeatureContract
}

/**
 * Wires a hostee channel into the emitter and assembles the public handle.
 *
 * @param broker - The nexus broker for this feature.
 * @param hostWindow - The resolved host window, or `null` when unembedded.
 * @param emitter - The subscription registry backing `handle.on`.
 * @param settings - Contract, handshake timing, and security settings.
 * @returns The frozen {@link FeatureHandle}.
 *
 * @example Assembling a feature handle around a broker
 * ```typescript
 * const handle = createFeatureHandle(broker, resolveHostWindow(window), emitter, { contract })
 * await handle.ready()
 * ```
 */
export function createFeatureHandle(
  broker: BrokerHandle,
  hostWindow: Window | null,
  emitter: EventEmitter,
  settings: FeatureHandleSettings
): FeatureHandle {
  let channel: ChannelHandle | null = null
  let opened = false
  const readyRejects: Array<(error: Error) => void> = []
  const requests = createRequestPeer('feature', (type, data) => channel?.send(type, data))
  // why: Indexed once per handle so every send/receive validates with a map lookup instead of rescanning the contract.
  const actions = buildActionIndex(settings.contract)

  if (hostWindow) {
    const activeChannel = broker.addChannel('host', hostWindow, {
      contractCompat: createContractCompat(),
      ...registerSecurity(broker, settings.protocol, settings.sharedKey),
      ...(settings.readyTimeoutMs !== undefined ? { connectTimeoutMs: settings.readyTimeoutMs } : {}),
    })
    channel = activeChannel
    const heartbeat = createHeartbeatEmitter((type) => activeChannel.send(type))
    const announcer = createSizeAnnouncer((type, data) => activeChannel.send(type, data))
    activeChannel.on('open', () => {
      opened = true
      // why: Settled ready() promises hold dead reject refs once open fires.
      readyRejects.splice(0)
      emitter.emit('open')
      heartbeat.start()
      announcer.start()
    })
    activeChannel.on('close', () => {
      opened = false
      emitter.emit('close')
      heartbeat.stop()
      announcer.stop()
      requests.rejectAll('The host channel closed before the host responded.')
    })
    activeChannel.on('deny', (data) => emitter.emit('error', data))
    activeChannel.on('invalid', (data) => emitter.emit('error', data))
    activeChannel.on('connect-timeout', (data) => {
      emitter.emit('error', { reason: 'ready-timeout', elapsedMs: data.elapsedMs })
      const error = createError(`The host did not open the connection within ${data.elapsedMs}ms.`)
      for (const reject of readyRejects.splice(0)) {
        reject(error)
      }
    })
    activeChannel.onMessage((message: IMessage) => {
      // why: Control traffic (heartbeat/size echoes, request/response envelopes) is SDK-internal; forwarding it would leak reserved __hf: types into consumer handlers.
      if (isControlType(message.type)) {
        requests.dispatch(message.type, message.data)
        return
      }
      // why: Invalid payloads are dropped before consumer handlers run; the error event carries the schema errors so the feature can diagnose the misbehaving host.
      const result = checkReceivePayload(actions, message.type, message.data)
      if (!result.valid) {
        emitter.emit('error', { reason: 'invalid-payload', type: message.type, errors: result.errors })
        return
      }
      emitter.emit(message.type, message.data)
    })
    activeChannel.connect()
  }

  return freeze(<FeatureHandle>{
    send: (type: string, data?: unknown) => {
      // why: Validated before the channel touches it so a schema violation throws in the sender's frame instead of surfacing on the host side.
      assertSendPayload(actions, type, data)
      channel?.send(type, data)
    },
    request: (type: string, data?: unknown, options?: RequestOptions) =>
      channel
        ? requests.request(type, data, options)
        : promiseReject(createError(`Cannot send request '${type}': the feature is not connected to a host.`)),
    handle: requests.handle,
    on: emitter.on,
    ready: () =>
      createPromise<void>((resolve, reject) => {
        if (opened) {
          resolve()
          return
        }
        emitter.on('open', () => resolve())
        readyRejects.push(reject)
      }),
    close: () => channel?.disconnect(),
  })
}
