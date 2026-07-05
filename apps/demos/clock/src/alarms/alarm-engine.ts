/**
 * In-memory, one-shot alarm engine.
 *
 * Alarms fire at the next occurrence of `HH:mm` in the timezone captured when
 * the alarm was armed, then disarm themselves. Timer scheduling goes through
 * the platform `setTimeout`, so tests drive it with fake timers.
 */
import { nextOccurrence } from '../time/clock-time'

/** An armed alarm. */
export interface Alarm {
  /** Stable id used by `clear-alarm`. */
  id: string
  /** The armed `HH:mm` time. */
  at: string
  /** Optional label echoed when the alarm fires. */
  label?: string
  /** Epoch milliseconds the alarm fires at. */
  firesAtEpochMs: number
}

/** Callback invoked when an armed alarm reaches its fire time. */
export type AlarmFireHandler = (alarm: Alarm) => void

/** The alarm engine handle. */
export interface AlarmEngine {
  /** Arms a one-shot alarm; returns the armed alarm. */
  set(at: string, timezone: string, label?: string): Alarm
  /** Disarms an alarm; returns the cleared alarm, or `null` for an unknown id. */
  clear(id: string): Alarm | null
  /** The armed alarms, soonest first. */
  list(): Alarm[]
  /** Disarms everything and cancels all timers. */
  dispose(): void
}

/**
 * Creates an alarm engine.
 *
 * @param onFire - Invoked when an alarm fires (after it has disarmed itself).
 * @param now - Clock source; defaults to `Date.now`.
 * @returns The {@link AlarmEngine} handle.
 *
 * @example Arming an alarm
 * ```typescript
 * const engine = createAlarmEngine((alarm) => flash(alarm.label))
 * const alarm = engine.set('07:30', 'Europe/Madrid')
 * ```
 */
export function createAlarmEngine(onFire: AlarmFireHandler, now: () => number = () => Date.now()): AlarmEngine {
  const armed = new Map<string, { alarm: Alarm; timer: ReturnType<typeof setTimeout> }>()
  let counter = 0

  return {
    set(at: string, timezone: string, label?: string): Alarm {
      counter += 1
      const id = `alarm-${counter}`
      const firesAtEpochMs = nextOccurrence(at, timezone, now())
      const alarm: Alarm = { id, at, firesAtEpochMs, ...(label !== undefined && { label }) }
      const timer = setTimeout(() => {
        armed.delete(id)
        onFire(alarm)
      }, firesAtEpochMs - now())
      armed.set(id, { alarm, timer })
      return alarm
    },

    clear(id: string): Alarm | null {
      const entry = armed.get(id)
      if (!entry) {
        return null
      }
      clearTimeout(entry.timer)
      armed.delete(id)
      return entry.alarm
    },

    list(): Alarm[] {
      return [...armed.values()].map((entry) => entry.alarm).sort((a, b) => a.firesAtEpochMs - b.firesAtEpochMs)
    },

    dispose(): void {
      for (const entry of armed.values()) {
        clearTimeout(entry.timer)
      }
      armed.clear()
    },
  }
}
