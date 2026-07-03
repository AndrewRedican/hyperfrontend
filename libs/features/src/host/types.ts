import type { EventHandler } from '../shared/event-emitter'
import type { ShellOptions } from '../shared/types'

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
   * Subscribes to feature messages or lifecycle events (`open`, `close`, `error`).
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
}

/**
 * Outcome of mounting a display mode: the window to message plus a teardown hook.
 */
export interface MountResult {
  /** Window the host messages, or `null` when a popup/standalone was blocked. */
  target: Window | null
  /** In-document root the mode mounted (embedded iframe or dialog container); unset when the feature opens in a separate window. */
  element?: HTMLElement
  /** Resizable element for content-driven sizing, when the mode embeds an iframe inline. */
  frame?: HTMLElement
  /** Removes any DOM or closes any window created by the mount. */
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
