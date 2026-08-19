import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { clearInterval, setInterval } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'

// note: The watchdog counts ticks since the last beat; a beat resets the count. While the page pair is unobservable (either side hidden), ticks pause — a throttled timer's silence is weak evidence. Crossing the miss threshold enters 'suspect' and fires the unresponsive callback once per episode; a later beat recovers to 'healthy' and re-arms it.
// note: 'healthy' is only ever spoken on evidence — the handshake that starts the watchdog, or a beat. Resuming observation grants a fresh miss budget but says nothing, because nothing has been heard yet.
const BEAT_INTERVAL_MS = 1000
const MISS_THRESHOLD = 3

/**
 * Liveness state of the connected feature, as judged by the watchdog.
 *
 * - `healthy`: beats are arriving within the expected budget.
 * - `unobservable`: silence carries no information yet. Either a page is
 *   hidden, so browser timer throttling makes the quiet meaningless and the
 *   watchdog pauses, or watching has just resumed and no beat has arrived to
 *   earn `healthy` back.
 * - `suspect`: the pages are visible and the miss budget is exhausted; the
 *   feature is probably unhealthy.
 * - `gone`: the session is closed or destroyed (or not yet open).
 */
export type HeartbeatState = 'healthy' | 'unobservable' | 'suspect' | 'gone'

/**
 * Snapshot of the watchdog's judgement.
 */
export interface HeartbeatStatus {
  /** Current liveness state. */
  state: HeartbeatState
  /** Consecutive watchdog ticks without a beat. */
  missedBeats: number
  /** Timestamp of the last received beat, or `null` if none arrived. */
  lastBeatAt: number | null
}

/**
 * Watchdog that tracks feature liveness from incoming beats.
 */
export interface HeartbeatMonitor {
  /** Records a received beat, resetting the miss counter and ending any suspect episode. */
  beat(): void
  /** Begins watching for missed beats; a no-op if already running. */
  start(): void
  /** Stops watching, releases the timer, and reports the `gone` state. */
  stop(): void
  /** Reports whether silence is currently meaningful (`false` while either page is hidden). */
  setObservable(observable: boolean): void
  /** Returns the current liveness snapshot. */
  getStatus(): HeartbeatStatus
}

/**
 * Creates the host-side heartbeat monitor.
 *
 * @param onUnresponsive - Invoked with the missed-beat count and the last beat
 * timestamp (or `null` if none arrived) each time the feature enters the
 * `suspect` state; a recovering beat re-arms it for the next episode.
 * @param onStateChange - Invoked with a {@link HeartbeatStatus} snapshot on
 * every liveness-state transition.
 * @returns A beat/start/stop/observability handle for the watchdog.
 *
 * @example Reacting to a hung feature
 * ```typescript
 * const monitor = createHeartbeatMonitor((missed) => shell.destroy(), (status) => console.log(status.state))
 * monitor.start()
 * ```
 */
export function createHeartbeatMonitor(
  onUnresponsive: (missedBeats: number, lastBeatAt: number | null) => void,
  onStateChange?: (status: HeartbeatStatus) => void
): HeartbeatMonitor {
  let missed = 0
  let lastBeatAt: number | null = null
  let timer: ReturnType<typeof setInterval> | undefined
  let observable = true
  let state: HeartbeatState = 'gone'

  const getStatus = (): HeartbeatStatus => ({ state, missedBeats: missed, lastBeatAt })

  const transition = (next: HeartbeatState) => {
    if (state === next) {
      return
    }
    state = next
    onStateChange?.(getStatus())
  }

  const stop = () => {
    clearInterval(timer)
    timer = undefined
    transition('gone')
  }

  return {
    beat() {
      missed = 0
      lastBeatAt = dateNow()
      // why: A beat is the only positive evidence of life there is — it ends a suspect episode, it is what earns `healthy` back after watching resumes, and it re-arms the unresponsive callback for the next episode.
      // why: While a page is hidden it does no more than keep the budget full. Silence means nothing there, so a beat is not a verdict there either, and the pair stays honestly unobservable.
      if (timer !== undefined && observable && state !== 'healthy') {
        transition('healthy')
      }
    },
    start() {
      if (timer !== undefined) {
        return
      }
      missed = 0
      transition(observable ? 'healthy' : 'unobservable')
      timer = setInterval(() => {
        if (!observable) {
          return
        }
        missed += 1
        if (missed >= MISS_THRESHOLD && state !== 'suspect') {
          transition('suspect')
          onUnresponsive(missed, lastBeatAt)
        }
      }, BEAT_INTERVAL_MS)
    },
    stop,
    setObservable(next: boolean) {
      if (observable === next) {
        return
      }
      observable = next
      if (timer === undefined) {
        return
      }
      if (!next) {
        transition('unobservable')
        return
      }
      // why: Returning to observability grants a fresh miss budget — beats throttled while hidden need time to resume before silence means anything again.
      // why: It does not grant health. Nothing has been heard since watching stopped, and a frame the browser killed while this page sat in the background will never be heard from again — calling that `healthy` hands every host a proof of life no beat backs, and readmits a dead frame to the scene on every return to the tab. The next beat says healthy; its absence says suspect.
      missed = 0
    },
    getStatus,
  }
}
