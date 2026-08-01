import { ControlType } from '../shared/control'

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
  const report = () => send(ControlType.Visibility, { hidden: document.visibilityState === 'hidden' })
  return {
    start() {
      if (cleanup) {
        return
      }
      report()
      document.addEventListener('visibilitychange', report)
      cleanup = () => document.removeEventListener('visibilitychange', report)
    },
    stop() {
      if (cleanup) {
        cleanup()
        cleanup = undefined
      }
    },
  }
}
