import type { DisplayMode } from '../shared/types'

// note: Reserved extension seam only — the SDK ships no experience plugins; these types are the contract a future release (or a consumer) implements to layer transitions/animations onto the built-in display modes, and nothing in the SDK consumes them yet.

/**
 * Context handed to an {@link ExperiencePlugin} around a feature's mount lifecycle.
 */
export interface ExperiencePluginContext {
  /** The root element the display mode mounted (dialog container or embedded frame). */
  element: HTMLElement
  /** The display mode the feature was surfaced in. */
  displayMode: DisplayMode
}

/**
 * Opt-in extension that decorates a feature's mount lifecycle (e.g. transitions, animations).
 *
 * This is a reserved seam: the SDK ships no plugins. Consumers — or a future SDK release —
 * implement this interface to layer experiences onto the built-in display modes.
 */
export interface ExperiencePlugin {
  /** Unique plugin name, surfaced in debug logs. */
  name: string
  /**
   * Runs after the feature mounts; may animate it in and return a teardown.
   *
   * @param context - The mounted element and its display mode.
   * @returns An optional teardown invoked on unmount.
   */
  onMount?(context: ExperiencePluginContext): void | (() => void)
  /**
   * Runs before the feature unmounts; may return a promise to defer teardown until an exit animation finishes.
   *
   * @param context - The mounted element and its display mode.
   * @returns Optionally a promise the shell awaits before tearing down.
   */
  onUnmount?(context: ExperiencePluginContext): void | Promise<void>
}
