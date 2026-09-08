import type { ShellOptions } from '../../shared/types'
import type { MountResult } from '../types'
import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { clearInterval, setInterval } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'

// note: Popup and standalone modes both open a separate browser window; only the sizing feature string differs, so the open/cleanup logic is shared.

// why: Nothing announces a window closing or an opener being severed, so the proxy is polled; the interval only has to beat the open timeout, which is measured in seconds.
const LOST_POLL_MS = 250

/**
 * Rejects a sandbox request on a display mode that opens a top-level window.
 *
 * The sandbox attribute only exists on iframes, so a popup or standalone
 * feature would open fully unconfined while the host believed containment was
 * in place; the mount fails fast in the caller's frame instead.
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
 * The returned `whenLost` watches the opened window for the moment it stops
 * being reachable from this page. That happens when the user closes it, and
 * also when the feature document carries an opener policy that severs the
 * relationship: a cross-origin isolated origin moves the window into its own
 * browsing-context group as it commits, after which the proxy reports itself
 * closed while the window is visibly open and every message into it is
 * discarded without error. The two are indistinguishable from here, so the
 * watch reports the observation and its timing rather than a cause.
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
  const openedAt = dateNow()
  const opened = window.open(url, '_blank', features)
  return {
    target: opened,
    ...(opened !== null && {
      whenLost: (onLost: (elapsedMs: number) => void) => {
        const poll = setInterval(() => {
          if (opened.closed) {
            clearInterval(poll)
            onLost(dateNow() - openedAt)
          }
        }, LOST_POLL_MS)
        return () => clearInterval(poll)
      },
    }),
    cleanup: () => {
      if (opened && !opened.closed) {
        opened.close()
      }
    },
  }
}
