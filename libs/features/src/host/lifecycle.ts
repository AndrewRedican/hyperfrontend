import type { BrokerHandle, ChannelHandle, IMessage } from '@hyperfrontend/nexus'
import type { EventEmitter } from '../shared/event-emitter'
import type { DismissPayload } from '../shared/presentation'
import type { RequestOptions } from '../shared/request'
import type { ExperiencePlugin, ExperiencePluginContext, FeatureContract, SecurityProtocol, ShellOptions } from '../shared/types'
import type { HeartbeatMonitor, HeartbeatStatus } from './heartbeat'
import type { DisplayModeMount, ShellHandle } from './types'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { promiseReject, promiseResolve } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { createURL } from '@hyperfrontend/immutable-api-utils/built-in-copy/url'
import { ControlType, isControlType } from '../shared/control'
import { assertSendPayload, buildActionIndex, checkReceivePayload } from '../shared/payload-validation'
import { createRequestPeer } from '../shared/request'
import { DisplayMode } from '../shared/types'
import { createContractCompat } from '../shared/version-compat'

// note: All DOM/window work lives in the injected mount functions, so this wiring stays DOM-free and exercisable with mock collaborators.

/**
 * Derives the origin the shell pins its channel sends to.
 *
 * @param url - The feature URL from the merged options, if any.
 * @returns The URL's origin, or `undefined` when no URL is configured or it
 * cannot be parsed (e.g. caller-provided targets with relative paths outside
 * a document context).
 */
function deriveFeatureOrigin(url: string | undefined): string | undefined {
  if (!url) {
    return undefined
  }
  try {
    return createURL(url, typeof document === 'undefined' ? undefined : document.baseURI).origin
  } catch {
    return undefined
  }
}

// why: ShellWiring lives here, not in the public types module, so the nexus type import never leaks into the consumer-facing host entry's .d.ts (self-contained rule).

/**
 * Injected collaborators for {@link createShellHandle}, kept swappable for tests.
 */
export interface ShellWiring {
  /**
   * The shell's own combined contract. Its `emitted` schemas validate every
   * outgoing payload (an invalid send throws in the host's frame) and its
   * `accepted` schemas validate every incoming payload (an invalid message is
   * dropped and surfaced as an `error` event).
   */
  contract: FeatureContract
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
   * @param onUnresponsive - Invoked with the missed-beat count and last beat timestamp on each entry into `suspect`.
   * @param onStateChange - Invoked with a status snapshot on every liveness-state transition.
   * @returns The heartbeat monitor.
   */
  createHeartbeatMonitor(
    onUnresponsive: (missedBeats: number, lastBeatAt: number | null) => void,
    onStateChange?: (status: HeartbeatStatus) => void
  ): HeartbeatMonitor
  /**
   * Observes the host page's visibility for the heartbeat watchdog.
   *
   * @param onChange - Receives `true` while the host page is hidden.
   * @returns A function that stops observing.
   */
  observeVisibility(onChange: (hidden: boolean) => void): () => void
}

/**
 * Loosely-typed payload of a boolean-flag control message (visibility and
 * dirty reports); the flag only counts when it is literally `true`.
 */
interface ControlFlagPayload {
  /** Hostee-reported hidden flag on a visibility report. */
  hidden?: unknown
  /** Hostee-declared unsaved-work flag on a dirty report. */
  dirty?: unknown
}

/**
 * Plugin bookkeeping for the currently mounted feature.
 */
interface ActivePlugins {
  /** Plugins registered for the current mount, in registration order. */
  registered: readonly ExperiencePlugin[]
  /** The frozen context handed to every hook of this mount. */
  context: ExperiencePluginContext
  /** Teardowns returned by `onMount`, in registration order. */
  teardowns: Array<() => void>
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
 * const shell = createShellHandle(broker, options, emitter, { contract, selectMount, registerSecurity, createHeartbeatMonitor })
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
  let visibilityTeardown: (() => void) | null = null
  let dirty = false
  let plugins: ActivePlugins | null = null
  let pendingUnmount: Promise<void> | null = null
  let queuedOpen: (() => void) | null = null
  // why: One peer outlives every open/close cycle so handlers registered before the first open (or across reopens) keep answering feature requests.
  const requests = createRequestPeer('host', (type, data) => channel?.send(type, data))
  // why: Indexed once per handle so every send/receive validates with a map lookup instead of rescanning the contract.
  const actions = buildActionIndex(wiring.contract)

  const emitError = (error: unknown) => emitter.emit('error', error)

  const runCleanup = () => {
    if (cleanup) {
      cleanup()
      cleanup = null
    }
  }

  const stopMonitor = () => {
    if (visibilityTeardown) {
      visibilityTeardown()
      visibilityTeardown = null
    }
    if (monitor) {
      monitor.stop()
      monitor = null
    }
  }

  const mountPlugins = (registered: readonly ExperiencePlugin[], element: HTMLElement | null, displayMode: DisplayMode) => {
    const context = freeze(<ExperiencePluginContext>{ element, displayMode })
    const teardowns: Array<() => void> = []
    for (const plugin of registered) {
      try {
        const teardown = plugin.onMount?.(context)
        if (teardown) {
          teardowns.push(teardown)
        }
      } catch (error) {
        emitError(error)
      }
    }
    plugins = { registered, context, teardowns }
  }

  const startUnmount = (state: ActivePlugins, finish: () => void) => {
    plugins = null
    let chain = promiseResolve()
    for (const plugin of [...state.registered].reverse()) {
      chain = chain.then(() => plugin.onUnmount?.(state.context)).catch(emitError)
    }
    pendingUnmount = chain.then(() => {
      for (const teardown of [...state.teardowns].reverse()) {
        try {
          teardown()
        } catch (error) {
          emitError(error)
        }
      }
      finish()
      pendingUnmount = null
      const reopen = queuedOpen
      queuedOpen = null
      reopen?.()
    })
  }

  const releaseChannelAndCleanup = () => {
    if (channel) {
      channel.destroy()
      channel = null
    }
    opened = false
    runCleanup()
  }

  const destroy = () => {
    requests.rejectAll('The shell was destroyed before the feature responded.')
    queuedOpen = null
    if (pendingUnmount) {
      return
    }
    stopMonitor()
    const state = plugins
    if (state) {
      startUnmount(state, releaseChannelAndCleanup)
      return
    }
    releaseChannelAndCleanup()
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

  const applyDismiss = (options: ShellOptions, data: unknown) => {
    // why: Dismiss signals only exist in dialog mode; anything a feature sends outside it is ignored — the host stays in control of its own lifecycle.
    if ((options.displayMode ?? DisplayMode.Embedded) !== DisplayMode.Dialog) {
      return
    }
    const source = (<DismissPayload | undefined>data)?.source
    if (source === 'escape') {
      if (options.closeOnEscape !== false) {
        close()
      }
      return
    }
    if (source === 'backdrop') {
      const behavior = options.dialogBackdrop ?? 'close'
      if (behavior === 'close') {
        close()
      } else if (behavior === 'event') {
        emitter.emit('dismiss', { source })
      }
    }
  }

  const open = (overrides?: Partial<ShellOptions>) => {
    destroy()
    if (pendingUnmount) {
      queuedOpen = () => open(overrides)
      return
    }
    const options = <ShellOptions>{ ...baseOptions, ...overrides }
    const displayMode = options.displayMode ?? DisplayMode.Embedded
    const result = wiring.selectMount(displayMode)({ options, requestClose: close })
    cleanup = result.cleanup
    if (result.target === null) {
      emitter.emit('error', createError('Feature window could not be opened.'))
      return
    }
    if (options.plugins && options.plugins.length > 0) {
      mountPlugins(options.plugins, result.element ?? null, displayMode)
    }
    const featureOrigin = deriveFeatureOrigin(options.url)
    // why: The origin pin restricts every send to the feature's origin before the first frame leaves; the timeout bounds the wire handshake.
    const activeChannel = broker.addChannel(`feature-${(openCount += 1)}`, result.target, {
      contractCompat: createContractCompat(),
      ...wiring.registerSecurity(broker, options.protocol, options.sharedKey),
      ...(featureOrigin ? { origin: featureOrigin } : {}),
      ...(options.openTimeoutMs !== undefined ? { connectTimeoutMs: options.openTimeoutMs } : {}),
    })
    channel = activeChannel
    // why: Queued before connect so the presentation announcement is the first message the feature receives after open — ahead of any consumer send issued in the meantime.
    activeChannel.send(ControlType.Present, result.present)
    const activeMonitor = wiring.createHeartbeatMonitor(
      (missedBeats, lastBeatAt) => applyUnresponsive(options, missedBeats, lastBeatAt),
      (status) => emitter.emit('status', status)
    )
    monitor = activeMonitor
    dirty = false
    // why: Either page being hidden throttles its timers, so the watchdog must treat silence as unobservable rather than as a dead feature.
    let selfHidden = false
    let peerHidden = false
    const applyObservability = () => activeMonitor.setObservable(!selfHidden && !peerHidden)
    visibilityTeardown = wiring.observeVisibility((hidden) => {
      selfHidden = hidden
      applyObservability()
    })
    channel.on('open', () => {
      opened = true
      emitter.emit('open')
      activeMonitor.start()
      // why: A mounted frame is not a displayed one — it stays hidden until the session opens, so the user never sees (or clicks into) a frame whose feature is not ready.
      result.reveal?.()
      // why: The presentation announcement already carried the initial size, so the reporter forwards only changes from here on.
      result.viewport?.start((size) => activeChannel.send(ControlType.Viewport, size))
    })
    channel.on('closing', (data) => emitter.emit('closing', data))
    channel.on('close', () => {
      opened = false
      dirty = false
      emitter.emit('close')
      stopMonitor()
      requests.rejectAll('The feature channel closed before the feature responded.')
      if (pendingUnmount) {
        return
      }
      const state = plugins
      if (state) {
        startUnmount(state, runCleanup)
        return
      }
      runCleanup()
    })
    channel.on('deny', (data) => emitter.emit('error', data))
    channel.on('invalid', (data) => emitter.emit('error', data))
    channel.on('connect-timeout', (data) => {
      // why: The feature never completed the handshake — tear the mount down and surface a distinguishable payload for fallback/retry UI.
      destroy()
      emitter.emit('error', { reason: 'open-timeout', elapsedMs: data.elapsedMs, displayMode })
    })
    channel.onMessage((message: IMessage) => {
      if (isControlType(message.type)) {
        if (message.type === ControlType.Beat) {
          activeMonitor.beat()
        } else if (message.type === ControlType.Dismiss) {
          applyDismiss(options, message.data)
        } else if (message.type === ControlType.Visibility) {
          peerHidden = (<ControlFlagPayload | undefined>message.data)?.hidden === true
          applyObservability()
        } else if (message.type === ControlType.Dirty) {
          dirty = (<ControlFlagPayload | undefined>message.data)?.dirty === true
          emitter.emit('dirty-state', { dirty })
        } else {
          requests.dispatch(message.type, message.data)
        }
        return
      }
      // why: Invalid payloads are dropped before consumer handlers run; the error event carries the schema errors so the host can diagnose the misbehaving feature.
      const result = checkReceivePayload(actions, message.type, message.data)
      if (!result.valid) {
        emitter.emit('error', { reason: 'invalid-payload', type: message.type, errors: result.errors })
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
    send: (type: string, data?: unknown) => {
      // why: Validated before the channel touches it so a schema violation throws in the sender's frame instead of surfacing on the feature side.
      assertSendPayload(actions, type, data)
      channel?.send(type, data)
    },
    request: (type: string, data?: unknown, options?: RequestOptions) =>
      channel ? requests.request(type, data, options) : promiseReject(createError(`Cannot send request '${type}': the shell is not open.`)),
    handle: requests.handle,
    on: emitter.on,
    get isOpen() {
      return opened
    },
    get isDirty() {
      return dirty
    },
  })
}
