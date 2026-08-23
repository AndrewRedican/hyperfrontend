import type { BrokerHandle, ChannelHandle } from '@hyperfrontend/nexus'
import type { EventEmitter } from '../shared/event-emitter'
import type { PresentPayload, ViewportPayload } from '../shared/presentation'
import type { FeatureContract, SecurityProtocol } from '../shared/types'
import type { PresentationApplier } from './sizing'
import type { FeatureHandle } from './types'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { buildChannelSettings, createMessagingCore, wireChannelEvents } from '../shared/channel-wiring'
import { ControlType } from '../shared/control'
import { registerSecurity } from '../shared/security'
import { DisplayMode } from '../shared/types'
import { createHeartbeatEmitter } from './heartbeat'
import { createPresentationApplier, watchWindowSize } from './sizing'
import { createVisibilityReporter } from './visibility'

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
  /** The feature's root layout element (or CSS selector), sized as the inner dialog box in dialog mode. */
  root?: string | HTMLElement
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
  const messaging = createMessagingCore({
    origin: 'feature',
    contract: settings.contract,
    emitter,
    disconnectedReason: 'the feature is not connected to a host',
    channel: () => channel,
  })

  let applier: PresentationApplier | null = null
  let stopWindowWatch: (() => void) | null = null

  if (hostWindow) {
    const activeChannel = broker.addChannel(
      'host',
      hostWindow,
      buildChannelSettings({
        security: registerSecurity(broker, settings.protocol, settings.sharedKey),
        connectTimeoutMs: settings.readyTimeoutMs,
      })
    )
    channel = activeChannel
    const heartbeat = createHeartbeatEmitter((type) => activeChannel.send(type))
    const visibility = createVisibilityReporter((type, data) => activeChannel.send(type, data))
    const activeApplier = createPresentationApplier(settings.root, (payload) => activeChannel.send(ControlType.Dismiss, payload))
    applier = activeApplier

    const applyPresent = (payload: PresentPayload) => {
      activeApplier.applyPresent(payload)
      emitter.emit('presentation', { mode: payload.mode })
      if (payload.viewport) {
        emitter.emit('resize', payload.viewport)
      }
      // why: In the windowed modes the browser window is the feature's viewport and no host reports arrive, so the feature's own resize events feed the same consumer-facing surface.
      if (payload.mode === DisplayMode.Popup || payload.mode === DisplayMode.Standalone) {
        stopWindowWatch ??= watchWindowSize((size) => emitter.emit('resize', size))
      }
    }
    const applyViewport = (payload: ViewportPayload) => {
      activeApplier.applyViewport(payload)
      emitter.emit('resize', payload)
    }

    activeChannel.on('open', () => {
      opened = true
      // why: Settled ready() promises hold dead reject refs once open fires.
      readyRejects.splice(0)
      emitter.emit('open')
      heartbeat.start()
      visibility.start()
    })
    wireChannelEvents(activeChannel, emitter)
    activeChannel.on('close', () => {
      opened = false
      emitter.emit('close')
      heartbeat.stop()
      visibility.stop()
      activeApplier.stop()
      if (stopWindowWatch) {
        stopWindowWatch()
        stopWindowWatch = null
      }
      messaging.requests.rejectAll('The host channel closed before the host responded.')
    })
    activeChannel.on('connect-timeout', (data) => {
      emitter.emit('error', { reason: 'ready-timeout', elapsedMs: data.elapsedMs })
      const error = createError(`The host did not open the connection within ${data.elapsedMs}ms.`)
      for (const reject of readyRejects.splice(0)) {
        reject(error)
      }
    })
    activeChannel.onMessage(
      messaging.createRouter((type, data) => {
        if (type === ControlType.Present) {
          applyPresent(<PresentPayload>data)
          return true
        }
        if (type === ControlType.Viewport) {
          applyViewport(<ViewportPayload>data)
          return true
        }
        return false
      })
    )
    activeChannel.connect()
  }

  return freeze(<FeatureHandle>{
    send: messaging.send,
    request: messaging.request,
    handle: messaging.requests.handle,
    on: emitter.on,
    setDirty: (isDirty: boolean) => {
      channel?.send(ControlType.Dirty, { dirty: isDirty === true })
    },
    hosted: hostWindow !== null,
    get displayMode() {
      return applier?.mode() ?? null
    },
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
