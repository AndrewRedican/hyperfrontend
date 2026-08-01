// note: The host page's own visibility feeds the heartbeat watchdog — a hidden page throttles both the watchdog's timer and the feature's beats, so its silence must not read as failure.

/**
 * Observes the host page's visibility, reporting whether it is hidden.
 *
 * Reports the current state immediately, then again on every change. Returns
 * a teardown that removes the listener; in a document-less environment the
 * observer is inert and the teardown is a no-op.
 *
 * @param onChange - Receives `true` while the host page is hidden.
 * @returns A function that stops observing.
 *
 * @example Feeding page visibility into the heartbeat watchdog
 * ```typescript
 * const stop = observePageVisibility((hidden) => monitor.setObservable(!hidden))
 * ```
 */
export function observePageVisibility(onChange: (hidden: boolean) => void): () => void {
  if (typeof document === 'undefined') {
    return () => undefined
  }
  const report = () => onChange(document.visibilityState === 'hidden')
  report()
  document.addEventListener('visibilitychange', report)
  return () => document.removeEventListener('visibilitychange', report)
}
