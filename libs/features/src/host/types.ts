import type { EventHandler } from '../shared/event-emitter'
import type { PresentPayload } from '../shared/presentation'
import type { RequestHandler, RequestOptions } from '../shared/request'
import type { ShellOptions } from '../shared/types'
import type { ViewportReporter } from './sizing'

/**
 * Public handle returned by {@link createShell}.
 */
export interface ShellHandle {
  /**
   * Mounts the feature using the merged create-time and call-time options.
   *
   * When a plugin teardown from the previous mount is still in flight, the
   * remount is queued until it settles; the latest `open` call wins.
   *
   * @param options - Per-open overrides layered over the create-time options.
   */
  open(options?: Partial<ShellOptions>): void
  /**
   * Closes the feature gracefully, disconnecting the messaging channel.
   *
   * The close is a polite exchange: the feature receives a `closing` notice
   * and may flush final messages before the channel completes the close (or
   * its deadline expires). Check `isDirty` first to take unsaved work into
   * account before starting the teardown.
   */
  close(): void
  /**
   * Closes the feature and releases all resources (channel and DOM).
   *
   * When experience plugins are registered, their `onUnmount` hooks are
   * awaited before the channel and DOM are released; calling `destroy` again
   * while that teardown is in flight is a no-op.
   */
  destroy(): void
  /**
   * Sends a typed message to the feature.
   *
   * @param type - Action type, drawn from the feature contract.
   * @param data - Optional payload for the action.
   */
  send(type: string, data?: unknown): void
  /**
   * Sends a request to the feature and resolves with its response.
   *
   * The feature answers through a handler it registered with its own
   * `handle(type, handler)`. The promise rejects when the feature's handler
   * throws, when the feature has no handler for the type, when no response
   * arrives within the timeout (30 seconds by default), when the shell is not
   * open, or when the channel closes or the shell is destroyed while the
   * request is pending.
   *
   * @param type - Request action type, drawn from the feature contract.
   * @param data - Optional payload for the request.
   * @param options - Per-request settings such as `timeoutMs`.
   * @returns A promise settling with the feature's response payload.
   *
   * @example Querying the feature for its current state
   * ```typescript
   * const time = await shell.request('getTime', { timezone: 'UTC' }, { timeoutMs: 5000 })
   * ```
   */
  request(type: string, data?: unknown, options?: RequestOptions): Promise<unknown>
  /**
   * Registers the handler that answers feature requests of a given type.
   *
   * One handler per type: registering a second handler for a type that already
   * has one throws. The handler may return the response value directly or a
   * promise of it; a thrown error or rejected promise reaches the feature as a
   * failed response carrying the error's message.
   *
   * @param type - Request type to answer.
   * @param handler - Receives the request payload and returns the response.
   * @returns A function that unregisters this handler.
   *
   * @example Answering a feature's request for host settings
   * ```typescript
   * shell.handle('getSettings', () => ({ locale: 'en-US' }))
   * ```
   */
  handle(type: string, handler: RequestHandler): () => void
  /**
   * Subscribes to feature messages or lifecycle events (`open`, `closing`,
   * `close`, `error`, `status`, `dirty-state`, `dismiss`).
   *
   * `status` fires on every liveness transition with a heartbeat snapshot
   * (`healthy`, `unobservable`, `suspect`, or `gone`). `dirty-state` fires
   * when the feature declares or clears unsaved work. `closing` announces a
   * polite teardown while the channel still delivers. `dismiss` fires with
   * `{ source: 'backdrop' }` when a dialog backdrop interaction occurs and
   * `dialogBackdrop` is set to `event`.
   *
   * @param event - Message action type or lifecycle event name.
   * @param handler - Callback invoked with the event payload.
   * @returns A function that removes this subscription.
   */
  on(event: string, handler: EventHandler): () => void
  /**
   * Whether the feature channel is currently open (`true` while connected).
   */
  readonly isOpen: boolean
  /**
   * Whether the feature has declared unsaved work (`true` between
   * `setDirty(true)` and `setDirty(false)`; resets when the channel closes).
   */
  readonly isDirty: boolean
}

/**
 * Outcome of mounting a display mode: the window to message plus a teardown hook.
 */
export interface MountResult {
  /** Window the host messages, or `null` when a popup/standalone was blocked. */
  target: Window | null
  /** In-document root the mode mounted (the feature iframe); unset when the feature opens in a separate window. */
  element?: HTMLElement
  /** Presentation announcement the shell sends the feature once per mount: the mode, the frame's initial dimensions, and any agreed dialog box geometry. */
  present: PresentPayload
  /** Reporter of the frame's exact pixel space, when the mode observes an iframe; the shell forwards its change reports once the channel opens. */
  viewport?: ViewportReporter
  /** Makes the mounted frame visible; the shell calls it once the session opens, so a frame never appears before the feature is ready. */
  reveal?(): void
  /**
   * Defers the connection handshake until the mounted frame can receive it,
   * invoking `begin` at that moment; returns a cancel hook for teardown before
   * readiness. When unset, the shell begins the handshake immediately.
   */
  whenReady?(begin: () => void): () => void
  /** Removes any DOM or closes any window created by the mount, stopping any observation it started. */
  cleanup(): void
}

/**
 * Context handed to a display-mode mount function.
 */
export interface MountContext {
  /** The fully merged shell options for this open. */
  options: ShellOptions
  /** Requests the shell close itself (overlay click, close button, Escape). */
  requestClose(): void
}

/**
 * Mounts a feature for a single display mode and returns its {@link MountResult}.
 *
 * @param context - The merged options and a close request callback.
 * @returns The messaging target and teardown hook.
 */
export type DisplayModeMount = (context: MountContext) => MountResult
