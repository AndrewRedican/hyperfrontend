/**
 * The pond's visibility authority.
 *
 * The browser announces visibility as an edge, and an edge is a notification:
 * something that has to be delivered to be heard. A page that never hears the
 * return to visible holds whatever it decided on the way out, and for the pond
 * that decision is a stopped clock and eight sleeping koi in front of a visitor
 * who is looking right at them. Waking is an action only the host can take, so
 * nothing recovers on its own.
 *
 * So the announcement is treated as the fast path rather than the only one, and
 * two readings that do not depend on delivery stand behind it. A coarse poll
 * re-reads the state the browser reports. A probe animation frame, armed only
 * while the pond believes itself hidden, turns a visitor's return into a waking
 * scene on the first frame the document is painted rather than on the next poll;
 * a genuinely hidden document is served no frames, so the probe costs nothing
 * exactly where the battery is worth protecting.
 *
 * The reverse direction is deliberately quieter. Frames stopping is not proof of
 * anything, since a blocked main thread looks identical, so silence never puts
 * the pond to sleep: only the announcement or a poll that reads hidden does.
 */

/** How often the watch re-reads the browser's own visibility, in milliseconds. */
const POLL_INTERVAL_MS = 2000

/** What settled the state the pond acted on. */
export type VisibilitySource = 'event' | 'poll' | 'frame'

/** What the watch needs from the pond. */
export interface VisibilityWatchOptions {
  /** Applies a visibility the pond has not acted on yet; never called with the state already applied. */
  apply(hidden: boolean, source: VisibilitySource): void
}

/** The pieces of the platform the watch reads, injected so specs can drive it by hand. */
export interface VisibilityWatchHost {
  /** Whether the browser currently calls this document hidden. */
  isHidden(): boolean
  /** Subscribes to the browser's visibility announcements; returns the unsubscribe. */
  listen(handler: () => void): () => void
  /** Requests one animation frame. */
  requestFrame(callback: () => void): number
  /** Cancels a pending frame request. */
  cancelFrame(handle: number): void
  /** Starts the reconciliation poll. */
  setPoll(callback: () => void, everyMs: number): number
  /** Stops the reconciliation poll. */
  clearPoll(handle: number): void
}

/** A running visibility watch. */
export interface VisibilityWatch {
  /** The hidden-ness the pond has acted on. */
  readonly hidden: boolean
  /** Stops watching and releases the listener, the poll and any probe frame. */
  dispose(): void
}

/**
 * Creates the pond's visibility watch.
 *
 * @param options - What the pond does when the state it has acted on turns out to be wrong.
 * @param host - Platform hooks; defaults to the browser's.
 * @returns The watch handle.
 *
 * @example Pausing and waking the scene
 * ```typescript
 * const visibility = createVisibilityWatch({
 *   apply: (hidden) => {
 *     hidden ? loop.stop() : loop.start()
 *     for (const session of sessions) {
 *       session.shell.send('sleep', { paused: hidden })
 *     }
 *   },
 * })
 * ```
 */
export function createVisibilityWatch(options: VisibilityWatchOptions, host?: Partial<VisibilityWatchHost>): VisibilityWatch {
  const isHidden = host?.isHidden ?? (() => document.visibilityState === 'hidden')
  const listen =
    host?.listen ??
    ((handler: () => void) => {
      document.addEventListener('visibilitychange', handler)
      return () => document.removeEventListener('visibilitychange', handler)
    })
  const requestFrame = host?.requestFrame ?? ((callback: () => void) => requestAnimationFrame(callback))
  const cancelFrame = host?.cancelFrame ?? ((handle: number) => cancelAnimationFrame(handle))
  const setPoll = host?.setPoll ?? ((callback: () => void, everyMs: number) => window.setInterval(callback, everyMs))
  const clearPoll = host?.clearPoll ?? ((handle: number) => window.clearInterval(handle))

  let applied = isHidden()
  let frame: number | null = null

  const stopProbe = (): void => {
    if (frame === null) {
      return
    }
    cancelFrame(frame)
    frame = null
  }

  const settle = (hidden: boolean, source: VisibilitySource): void => {
    if (hidden === applied) {
      return
    }
    applied = hidden
    if (hidden) {
      startProbe()
    } else {
      stopProbe()
    }
    options.apply(hidden, source)
  }

  const onFrame = (): void => {
    frame = null
    // why: The document is being painted, so an announcement that never arrived is no longer worth waiting for; the state itself is what the pond acts on, since a frame can still be served on the way into hiding.
    if (!isHidden()) {
      settle(false, 'frame')
      return
    }
    startProbe()
  }

  // note: Only ever called with no frame outstanding: a probe is armed on the way into hidden and released on the way out.
  const startProbe = (): void => {
    frame = requestFrame(onFrame)
  }

  if (applied) {
    startProbe()
  }
  const stopListening = listen(() => settle(isHidden(), 'event'))
  const poll = setPoll(() => settle(isHidden(), 'poll'), POLL_INTERVAL_MS)

  return {
    get hidden() {
      return applied
    },
    dispose() {
      stopListening()
      clearPoll(poll)
      stopProbe()
    },
  }
}
