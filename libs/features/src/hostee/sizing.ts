import { onElementResize } from '@hyperfrontend/ui-utils/element'
import { addStylesheet } from '@hyperfrontend/ui-utils/style'
import { ControlType } from '../shared/control'

// note: The feature page resets its own body so the embedded UI fills the iframe edge-to-edge with a transparent backdrop; the host cannot touch the cross-origin body itself.
const BODY_RESET_CSS = 'html,body{margin:0;padding:0;background:transparent}'

/**
 * Neutralizes the feature page's body so the embedded UI is neither clipped nor padded.
 *
 * @example Resetting the body when a feature initializes
 * ```typescript
 * applyBodyReset()
 * ```
 */
export function applyBodyReset(): void {
  addStylesheet(BODY_RESET_CSS)
}

/**
 * Announces the feature's own content size to the host as it changes.
 */
export interface SizeAnnouncer {
  /** Sends the current size and begins watching for changes; a no-op if already running. */
  start(): void
  /** Stops watching for size changes. */
  stop(): void
}

/**
 * Creates the hostee-side content-size announcer.
 *
 * @param send - The control-channel send function (receives the reserved size type).
 * @returns A start/stop handle for the size-announcement loop.
 *
 * @example Announcing size to the host while connected
 * ```typescript
 * const announcer = createSizeAnnouncer((type, data) => channel.send(type, data))
 * announcer.start()
 * ```
 */
export function createSizeAnnouncer(send: (type: string, data: unknown) => void): SizeAnnouncer {
  let cleanup: (() => void) | undefined
  const announce = () => send(ControlType.Size, { width: document.body.scrollWidth, height: document.body.scrollHeight })
  return {
    start() {
      if (cleanup) {
        return
      }
      announce()
      cleanup = onElementResize(document.body, announce)
    },
    stop() {
      if (cleanup) {
        cleanup()
        cleanup = undefined
      }
    },
  }
}
