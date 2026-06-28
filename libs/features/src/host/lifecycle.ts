import type { BrokerHandle, ChannelHandle, IMessage } from '@hyperfrontend/nexus'
import type { EventEmitter } from '../shared/event-emitter'
import type { SecurityProtocol, ShellOptions } from '../shared/types'
import type { HeartbeatMonitor } from './heartbeat'
import type { DisplayModeMount, ShellHandle } from './types'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { ControlType, isControlType } from '../shared/control'
import { DisplayMode } from '../shared/types'
import { applyContentSize } from './sizing'

// note: All DOM/window work lives in the injected mount functions, so this wiring stays DOM-free and exercisable with mock collaborators.

// why: ShellWiring lives here, not in the public types module, so the nexus type import never leaks into the consumer-facing host entry's .d.ts (self-contained rule).

/**
 * Injected collaborators for {@link createShellHandle}, kept swappable for tests.
 */
export interface ShellWiring {
  /**
   * Resolves the mount function for a display mode.
   *
   * @param mode - The display mode to resolve.
   * @returns The matching mount function.
   */
  selectMount(mode: DisplayMode): DisplayModeMount
  /**
   * Registers the selected security protocol on the broker.
   *
   * @param broker - The shell's nexus broker.
   * @param protocol - The selected protocol, or `undefined` for none.
   * @param sharedKey - The pre-shared key for `v2`.
   * @returns The channel settings to apply, or `undefined` for no security.
   */
  registerSecurity(
    broker: BrokerHandle,
    protocol: SecurityProtocol | undefined,
    sharedKey: string | undefined
  ): Record<string, unknown> | undefined
  /**
   * Builds the heartbeat watchdog that detects an unresponsive feature.
   *
   * @param onUnresponsive - Invoked with the missed-beat count and last beat timestamp.
   * @returns The heartbeat monitor.
   */
  createHeartbeatMonitor(onUnresponsive: (missedBeats: number, lastBeatAt: number | null) => void): HeartbeatMonitor
}

/**
 * Assembles a host {@link ShellHandle} around a broker and injected collaborators.
 *
 * @param broker - The nexus broker dedicated to this shell.
 * @param baseOptions - Create-time options, overridden per `open` call.
 * @param emitter - The subscription registry backing `handle.on`.
 * @param wiring - Mount selection and security registration collaborators.
 * @returns The frozen {@link ShellHandle}.
 *
 * @example Assembling a shell handle
 * ```typescript
 * const shell = createShellHandle(broker, options, emitter, { selectMount, registerSecurity })
 * shell.open({ displayMode: 'dialog' })
 * ```
 */
export function createShellHandle(
  broker: BrokerHandle,
  baseOptions: ShellOptions,
  emitter: EventEmitter,
  wiring: ShellWiring
): ShellHandle {
  let channel: ChannelHandle | null = null
  let cleanup: (() => void) | null = null
  let opened = false
  let openCount = 0
  let monitor: HeartbeatMonitor | null = null

  const runCleanup = () => {
    if (cleanup) {
      cleanup()
      cleanup = null
    }
  }

  const stopMonitor = () => {
    if (monitor) {
      monitor.stop()
      monitor = null
    }
  }

  const destroy = () => {
    stopMonitor()
    if (channel) {
      channel.destroy()
      channel = null
    }
    opened = false
    runCleanup()
  }

  const close = () => {
    if (channel) {
      channel.disconnect()
      return
    }
    runCleanup()
  }

  const applyUnresponsive = (options: ShellOptions, missedBeats: number, lastBeatAt: number | null) => {
    const policy = options.onUnresponsive ?? 'emit'
    if (typeof policy === 'function') {
      policy({ missedBeats, lastBeatAt, displayMode: options.displayMode ?? DisplayMode.Embedded, close, destroy })
      return
    }
    emitter.emit('error', createError('Feature became unresponsive.'))
    if (policy === 'unmount') {
      destroy()
    }
  }

  const open = (overrides?: Partial<ShellOptions>) => {
    destroy()
    const options = <ShellOptions>{ ...baseOptions, ...overrides }
    const result = wiring.selectMount(options.displayMode ?? DisplayMode.Embedded)({ options, requestClose: close })
    cleanup = result.cleanup
    if (result.target === null) {
      emitter.emit('error', createError('Feature window could not be opened.'))
      return
    }
    channel = broker.addChannel(
      `feature-${(openCount += 1)}`,
      result.target,
      wiring.registerSecurity(broker, options.protocol, options.sharedKey)
    )
    const sizeFrame = options.embedSizing === 'content' ? result.frame : undefined
    const activeMonitor = wiring.createHeartbeatMonitor((missedBeats, lastBeatAt) => applyUnresponsive(options, missedBeats, lastBeatAt))
    monitor = activeMonitor
    channel.on('open', () => {
      opened = true
      emitter.emit('open')
      activeMonitor.start()
    })
    channel.on('close', () => {
      opened = false
      emitter.emit('close')
      stopMonitor()
      runCleanup()
    })
    channel.on('deny', (data) => emitter.emit('error', data))
    channel.on('invalid', (data) => emitter.emit('error', data))
    channel.onMessage((message: IMessage) => {
      if (isControlType(message.type)) {
        if (message.type === ControlType.Beat) {
          activeMonitor.beat()
        } else if (message.type === ControlType.Size && sizeFrame) {
          applyContentSize(sizeFrame, message.data)
        }
        return
      }
      emitter.emit(message.type, message.data)
    })
    channel.connect()
  }

  return freeze(<ShellHandle>{
    open,
    close,
    destroy,
    send: (type: string, data?: unknown) => channel?.send(type, data),
    on: emitter.on,
    get isOpen() {
      return opened
    },
  })
}
