import type { MountResult } from '../types'

// note: Popup and standalone modes both open a separate browser window; only the sizing feature string differs, so the open/cleanup logic is shared.

/**
 * Opens a feature in a separate browser window and wraps it as a mount result.
 *
 * @param url - The feature app URL to load.
 * @param features - Optional `window.open` feature string (sizing for popups).
 * @returns A mount result whose `target` is `null` if the browser blocked it.
 *
 * @example Opening a sized popup
 * ```typescript
 * const { target, cleanup } = openExternalWindow('https://clock.example.com', 'width=530,height=550')
 * ```
 */
export function openExternalWindow(url: string, features?: string): MountResult {
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
