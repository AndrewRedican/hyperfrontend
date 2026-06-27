import type { DisplayMode } from '../shared/types'

// note: Opt-in extension seam — implement ExperiencePlugin to layer transitions/animations onto the built-in display modes. The SDK ships no built-in experience plugins; these types are the contract a consumer implements to provide one.

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
 * Implement this interface to layer experiences onto the built-in display modes,
 * then pass the plugin to the host shell. The SDK ships no built-in plugins.
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
