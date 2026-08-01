import type { ShellOptions } from '../../shared/types'
import type { MountResult } from '../types'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

// note: Popup and standalone modes both open a separate browser window; only the sizing feature string differs, so the open/cleanup logic is shared.

/**
 * Rejects a sandbox request on a display mode that opens a top-level window.
 *
 * The sandbox attribute only exists on iframes, so a popup or standalone
 * feature would open fully unconfined while the host believed containment was
 * in place — the mount fails fast in the caller's frame instead.
 *
 * @param sandbox - The `sandbox` value from the merged shell options.
 * @param mode - The display-mode name, used in the error message.
 *
 * @example Guarding a windowed display mode before it opens
 * ```typescript
 * assertNoSandbox(options.sandbox, 'popup')
 * ```
 */
export function assertNoSandbox(sandbox: ShellOptions['sandbox'], mode: string): void {
  if (sandbox !== undefined && sandbox !== false) {
    throw createError(
      `The "${mode}" display mode opens a top-level window, which cannot be sandboxed. Remove the "sandbox" option or use the embedded or dialog display mode.`
    )
  }
}

/**
 * Opens a feature in a separate browser window and wraps it as a mount result.
 *
 * @param url - The feature app URL to load.
 * @param features - Optional `window.open` feature string (sizing for popups).
 * @returns A mount result (minus the mode-specific presentation announcement the caller adds) whose `target` is `null` if the browser blocked it.
 *
 * @example Opening a sized popup
 * ```typescript
 * const { target, cleanup } = openExternalWindow('https://clock.example.com', 'width=530,height=550')
 * ```
 */
export function openExternalWindow(url: string, features?: string): Omit<MountResult, 'present'> {
  const opened = window.open(url, '_blank', features)
  return {
    target: opened,
    cleanup: () => {
      if (opened && !opened.closed) {
        opened.close()
      }
    },
  }
}
