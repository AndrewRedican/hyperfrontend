import {
  cancelAnimationFrame,
  clearInterval,
  requestAnimationFrame,
  setInterval,
} from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'

// note: Visibility arrives as an announcement, and an announcement has to be delivered to be heard. A page that never hears its return to visible holds whatever it concluded on the way out for the rest of the session, and both sides of the SDK conclude something load-bearing there: the host stops judging silence, the feature tells the host to stop judging it. So the announcement is the fast path rather than the only path, and two readings that do not depend on delivery stand behind it.

/** How often the watch re-reads the page's own visibility, in milliseconds. */
const POLL_INTERVAL_MS = 2000

/**
 * Watches this page's visibility, reporting whether it is hidden.
 *
 * Reports the current state immediately, then again on every change to it, and
 * never repeats a state already reported. The page's own announcement is the
 * fast path. Behind it, a coarse poll re-reads the state, and a probe animation
 * frame armed only while the page is believed hidden turns a return to the
 * page into a report on the first frame it is painted rather than on the next
 * poll. A genuinely hidden page is served no frames, so the probe costs nothing
 * exactly where the battery is worth protecting.
 *
 * The reverse direction stays quiet on purpose: frames stopping is equally a
 * blocked main thread, so silence never reports hidden. Only the announcement
 * or a poll that reads hidden does.
 *
 * @param onChange - Receives `true` while the page is hidden.
 * @returns A function that stops watching and releases the poll and any probe frame.
 *
 * @example Feeding page visibility into the heartbeat watchdog
 * ```typescript
 * const stop = watchPageVisibility((hidden) => monitor.setObservable(!hidden))
 * ```
 */
export function watchPageVisibility(onChange: (hidden: boolean) => void): () => void {
  const isHidden = () => document.visibilityState === 'hidden'
  let reported = isHidden()
  let frame: number | null = null

  const stopProbe = (): void => {
    if (frame === null) {
      return
    }
    cancelAnimationFrame(frame)
    frame = null
  }

  const settle = (hidden: boolean): void => {
    if (hidden === reported) {
      return
    }
    reported = hidden
    if (hidden) {
      startProbe()
    } else {
      stopProbe()
    }
    onChange(hidden)
  }

  const onFrame = (): void => {
    frame = null
    // why: The page is being painted, so an announcement that never arrived is no longer worth waiting for; the state itself is what the report is taken from, since a frame can still be served on the way into hiding.
    if (!isHidden()) {
      settle(false)
      return
    }
    startProbe()
  }

  // note: Only ever called with no frame outstanding: a probe is armed on the way into hidden and released on the way out.
  const startProbe = (): void => {
    frame = requestAnimationFrame(onFrame)
  }

  const announced = () => settle(isHidden())
  if (reported) {
    startProbe()
  }
  document.addEventListener('visibilitychange', announced)
  const poll = setInterval(() => settle(isHidden()), POLL_INTERVAL_MS)
  onChange(reported)

  return () => {
    document.removeEventListener('visibilitychange', announced)
    clearInterval(poll)
    stopProbe()
  }
}
