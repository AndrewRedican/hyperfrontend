/**
 * The clock's owned state — format, timezone, locale, and alarms.
 *
 * The feature owns all of this; hosts only command changes through the contract
 * and receive echo events. Both the UI and the contract wiring read and mutate
 * state through this single store.
 */
import type { Ref } from 'vue'
import type { Alarm } from '../alarms/alarm-engine'
import type { CoinFace } from '../physics/coin-physics'
import { ref } from 'vue'
import { createAlarmEngine } from '../alarms/alarm-engine'

/** Why the clock's format changed — mirrors the contract's `format-changed.cause`. */
export type FormatCause = 'user' | 'host' | 'alarm'

/** The reactive clock state plus its mutators. */
export interface ClockStore {
  /** The clock's format — the face the coin rests on. */
  format: Ref<CoinFace>
  /** IANA timezone the clock displays in. */
  timezone: Ref<string>
  /** BCP-47 locale used for formatting. */
  locale: Ref<string>
  /** Armed alarms, soonest first. */
  alarms: Ref<Alarm[]>
  /** The alarm currently firing, until dismissed. */
  firing: Ref<Alarm | null>
  /** Arms a one-shot alarm in the clock's current timezone. */
  setAlarm(at: string, label?: string): Alarm
  /** Disarms an alarm; returns it, or `null` for an unknown id. */
  clearAlarm(id: string): Alarm | null
  /** Stops showing the firing alarm. */
  dismissFiring(): void
  /** Registers a listener for alarms reaching their fire time. */
  onAlarmFired(handler: (alarm: Alarm) => void): void
  /** Reports that the coin settled on a face (called by the UI layer). */
  notifyFormatSettled(face: CoinFace, cause: FormatCause): void
  /** Registers a listener for the coin settling on a face. */
  onFormatSettled(handler: (face: CoinFace, cause: FormatCause) => void): void
}

/**
 * Builds a fresh clock store.
 *
 * The app uses the {@link useClockStore} singleton; tests build isolated stores.
 *
 * @returns The reactive store handle.
 */
export function createClockStore(): ClockStore {
  const format = ref<CoinFace>('analog')
  const timezone = ref(new Intl.DateTimeFormat().resolvedOptions().timeZone)
  const locale = ref(typeof navigator === 'undefined' ? 'en-US' : navigator.language)
  const alarms = ref<Alarm[]>([])
  const firing = ref<Alarm | null>(null)
  const fireHandlers: ((alarm: Alarm) => void)[] = []
  const settleHandlers: ((face: CoinFace, cause: FormatCause) => void)[] = []

  const engine = createAlarmEngine((alarm) => {
    alarms.value = engine.list()
    firing.value = alarm
    fireHandlers.forEach((handler) => handler(alarm))
  })

  return {
    format,
    timezone,
    locale,
    alarms,
    firing,
    setAlarm(at: string, label?: string): Alarm {
      const alarm = engine.set(at, timezone.value, label)
      alarms.value = engine.list()
      return alarm
    },
    clearAlarm(id: string): Alarm | null {
      const alarm = engine.clear(id)
      alarms.value = engine.list()
      return alarm
    },
    dismissFiring(): void {
      firing.value = null
    },
    onAlarmFired(handler: (alarm: Alarm) => void): void {
      fireHandlers.push(handler)
    },
    notifyFormatSettled(face: CoinFace, cause: FormatCause): void {
      settleHandlers.forEach((handler) => handler(face, cause))
    },
    onFormatSettled(handler: (face: CoinFace, cause: FormatCause) => void): void {
      settleHandlers.push(handler)
    },
  }
}

const store = createClockStore()

/**
 * The app-wide clock store singleton.
 *
 * @returns The shared {@link ClockStore}.
 *
 * @example Reading the current format
 * ```typescript
 * const { format } = useClockStore()
 * console.log(format.value)
 * ```
 */
export function useClockStore(): ClockStore {
  return store
}
