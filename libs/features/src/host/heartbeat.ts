import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { clearInterval, setInterval } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'

// note: The watchdog counts ticks since the last beat; a beat resets the count. Crossing the miss threshold fires once and stops, leaving the unresponsive policy to act.
const BEAT_INTERVAL_MS = 1000
const MISS_THRESHOLD = 3

/**
 * Watchdog that tracks feature liveness from incoming beats.
 */
export interface HeartbeatMonitor {
  /** Records a received beat, resetting the miss counter. */
  beat(): void
  /** Begins watching for missed beats; a no-op if already running. */
  start(): void
  /** Stops watching and releases the timer. */
  stop(): void
}

/**
 * Creates the host-side heartbeat monitor.
 *
 * @param onUnresponsive - Invoked once with the missed-beat count and the last beat
 * timestamp (or `null` if none arrived) when the feature crosses the miss threshold.
 * @returns A beat/start/stop handle for the watchdog.
 *
 * @example Reacting to a hung feature
 * ```typescript
 * const monitor = createHeartbeatMonitor((missed) => shell.destroy())
 * monitor.start()
 * ```
 */
export function createHeartbeatMonitor(onUnresponsive: (missedBeats: number, lastBeatAt: number | null) => void): HeartbeatMonitor {
  let missed = 0
  let lastBeatAt: number | null = null
  let timer: ReturnType<typeof setInterval> | undefined

  const stop = () => {
    clearInterval(timer)
    timer = undefined
  }

  return {
    beat() {
      missed = 0
      lastBeatAt = dateNow()
    },
    start() {
      if (timer !== undefined) {
        return
      }
      missed = 0
      timer = setInterval(() => {
        missed += 1
        if (missed >= MISS_THRESHOLD) {
          stop()
          onUnresponsive(missed, lastBeatAt)
        }
      }, BEAT_INTERVAL_MS)
    },
    stop,
  }
}
