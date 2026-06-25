import { clearInterval, setInterval } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { ControlType } from '../shared/control'

// note: Baked-in liveness — the feature emits a beat on a fixed cadence with no consumer involvement, and the host monitors these to detect a hung or crashed feature.
const BEAT_INTERVAL_MS = 1000

/**
 * Hidden heartbeat emitter that pulses the host on a fixed cadence.
 */
export interface HeartbeatEmitter {
  /** Begins emitting beats; a no-op if already running. */
  start(): void
  /** Stops emitting beats and releases the timer. */
  stop(): void
}

/**
 * Creates the hostee-side heartbeat emitter.
 *
 * @param send - The control-channel send function (receives the reserved beat type).
 * @returns A start/stop handle for the beat loop.
 *
 * @example Pulsing the host while connected
 * ```typescript
 * const heartbeat = createHeartbeatEmitter((type) => channel.send(type))
 * heartbeat.start()
 * ```
 */
export function createHeartbeatEmitter(send: (type: string) => void): HeartbeatEmitter {
  let timer: ReturnType<typeof setInterval> | undefined
  return {
    start() {
      if (timer !== undefined) {
        return
      }
      timer = setInterval(() => send(ControlType.Beat), BEAT_INTERVAL_MS)
    },
    stop() {
      clearInterval(timer)
      timer = undefined
    },
  }
}
