import { ControlType } from '../shared/control'
import { watchPageVisibility } from '../shared/page-visibility'

// note: The feature reports its own page visibility so the host's watchdog can treat silence from a hidden (timer-throttled) page as weak evidence rather than failure — the pages differ when the feature runs in a popup.

/**
 * Reporter that announces the feature page's visibility to the host.
 */
export interface VisibilityReporter {
  /** Sends the current visibility and begins watching for changes; a no-op if already running. */
  start(): void
  /** Stops watching for visibility changes. */
  stop(): void
}

/**
 * Creates the hostee-side page-visibility reporter.
 *
 * Each state is sent once: the current one when the reporter starts, and every
 * change after that.
 *
 * @param send - The control-channel send function (receives the reserved visibility type).
 * @returns A start/stop handle for the visibility reports.
 *
 * @example Reporting visibility to the host while connected
 * ```typescript
 * const reporter = createVisibilityReporter((type, data) => channel.send(type, data))
 * reporter.start()
 * ```
 */
export function createVisibilityReporter(send: (type: string, data: unknown) => void): VisibilityReporter {
  let cleanup: (() => void) | undefined
  return {
    start() {
      if (cleanup) {
        return
      }
      cleanup = watchPageVisibility((hidden) => send(ControlType.Visibility, { hidden }))
    },
    stop() {
      if (cleanup) {
        cleanup()
        cleanup = undefined
      }
    },
  }
}
