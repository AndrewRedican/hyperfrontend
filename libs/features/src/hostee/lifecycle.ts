import type { BrokerHandle, ChannelHandle, IMessage } from '@hyperfrontend/nexus'
import type { EventEmitter } from '../shared/event-emitter'
import type { FeatureHandle } from './types'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
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
 * Wires a hostee channel into the emitter and assembles the public handle.
 *
 * @param broker - The nexus broker for this feature.
 * @param hostWindow - The resolved host window, or `null` when unembedded.
 * @param emitter - The subscription registry backing `handle.on`.
 * @returns The frozen {@link FeatureHandle}.
 *
 * @example Assembling a feature handle around a broker
 * ```typescript
 * const handle = createFeatureHandle(broker, resolveHostWindow(window), emitter)
 * await handle.ready()
 * ```
 */
export function createFeatureHandle(broker: BrokerHandle, hostWindow: Window | null, emitter: EventEmitter): FeatureHandle {
  let channel: ChannelHandle | null = null
  let opened = false

  if (hostWindow) {
    const activeChannel = broker.addChannel('host', hostWindow)
    channel = activeChannel
    const heartbeat = createHeartbeatEmitter((type) => activeChannel.send(type))
    const announcer = createSizeAnnouncer((type, data) => activeChannel.send(type, data))
    activeChannel.on('open', () => {
      opened = true
      emitter.emit('open')
      heartbeat.start()
      announcer.start()
    })
    activeChannel.on('close', () => {
      opened = false
      emitter.emit('close')
      heartbeat.stop()
      announcer.stop()
    })
    activeChannel.on('deny', (data) => emitter.emit('error', data))
    activeChannel.on('invalid', (data) => emitter.emit('error', data))
    activeChannel.onMessage((message: IMessage) => emitter.emit(message.type, message.data))
    activeChannel.connect()
  }

  return freeze(<FeatureHandle>{
    send: (type: string, data?: unknown) => channel?.send(type, data),
    on: emitter.on,
    ready: () =>
      createPromise<void>((resolve) => {
        if (opened) {
          resolve()
          return
        }
        emitter.on('open', () => resolve())
      }),
    close: () => channel?.disconnect(),
  })
}
