/**
 * Binds the clock's contract actions to the clock store.
 *
 * The feature owns all state; every host command mutates the store, and the
 * store's reactions come back as echo events. Injected as plain functions so
 * the wiring is unit-testable without a live host channel.
 */
import type { ClockStore } from '../state/clock-store'
import { buildSnapshot, isValidAlarmTime } from '../time/clock-time'

/** The slice of the feature handle the wiring needs. */
export interface FeatureLink {
  /** Sends a contract event to the host. */
  send(type: string, data?: unknown): void
  /** Registers a handler for a host command. */
  on(event: string, handler: (data: unknown) => void): unknown
  /** Registers a responder for a correlated host request. */
  handle(type: string, handler: (data: unknown) => unknown): unknown
  /** Reports whether the feature holds state worth confirming before close. */
  setDirty(dirty: boolean): void
}

/** Wiring options — injectable clock for tests. */
export interface WireOptions {
  /** Clock source; defaults to `Date.now`. */
  now?: () => number
}

/**
 * Narrows an unknown payload to a plain record.
 *
 * @param value - The candidate payload.
 * @returns `true` when the value is a non-null object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Checks a candidate IANA timezone id by asking `Intl` to use it.
 *
 * @param timezone - The candidate id.
 * @returns `true` when the runtime accepts the timezone.
 */
function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

/**
 * Checks a candidate BCP-47 locale.
 *
 * @param locale - The candidate tag.
 * @returns `true` when the runtime accepts the locale.
 */
function isValidLocale(locale: string): boolean {
  try {
    return Intl.getCanonicalLocales(locale).length > 0
  } catch {
    return false
  }
}

/**
 * Wires every accepted contract action to the store and mirrors store changes
 * back as emitted events.
 *
 * @param feature - The feature handle (or a test double) to bind.
 * @param store - The clock store owning all state.
 * @param options - Injectable clock.
 * @returns A function that starts the 1 Hz tick stream and returns its stopper.
 *
 * @example Wiring the live feature
 * ```typescript
 * const startTicking = wireClockContract(feature, useClockStore())
 * feature.ready().then(() => startTicking())
 * ```
 */
export function wireClockContract(feature: FeatureLink, store: ClockStore, options: WireOptions = {}): () => () => void {
  const now = options.now ?? (() => Date.now())
  const snapshot = () => buildSnapshot(now(), store.timezone.value, store.locale.value, store.format.value)

  // how: A correlated request gets the snapshot back directly; the `time` echo
  // still fires so plain event listeners observe the answer too.
  feature.handle('get-time', () => {
    const current = snapshot()
    feature.send('time', current)
    return current
  })

  // why: Armed alarms are the clock's unsaved state — a host proposing a close
  // sees `dirty` until every alarm has fired or been cleared.
  const reportAlarmDirty = () => {
    feature.setDirty(store.alarms.value.length > 0)
  }

  feature.on('set-format', (data) => {
    if (isRecord(data) && (data['format'] === 'analog' || data['format'] === 'digital')) {
      // note: The store mutation plays out as a physics flip; the echo event is
      // emitted when the coin settles (see onFormatSettled below).
      store.format.value = data['format']
    }
  })

  feature.on('set-timezone', (data) => {
    if (isRecord(data) && typeof data['timezone'] === 'string' && isValidTimezone(data['timezone'])) {
      store.timezone.value = data['timezone']
      feature.send('timezone-changed', { timezone: data['timezone'] })
    }
  })

  feature.on('set-locale', (data) => {
    if (isRecord(data) && typeof data['locale'] === 'string' && isValidLocale(data['locale'])) {
      store.locale.value = data['locale']
      feature.send('locale-changed', { locale: data['locale'] })
    }
  })

  feature.on('set-alarm', (data) => {
    if (isRecord(data) && typeof data['at'] === 'string' && isValidAlarmTime(data['at'])) {
      const label = typeof data['label'] === 'string' ? data['label'] : undefined
      const alarm = store.setAlarm(data['at'], label)
      feature.send('alarm-set', { id: alarm.id, at: alarm.at, firesAtEpochMs: alarm.firesAtEpochMs })
      reportAlarmDirty()
    }
  })

  feature.on('clear-alarm', (data) => {
    if (isRecord(data) && typeof data['id'] === 'string') {
      const alarm = store.clearAlarm(data['id'])
      if (alarm !== null) {
        feature.send('alarm-cleared', { id: alarm.id })
        reportAlarmDirty()
      }
    }
  })

  let lastFormat = store.format.value
  store.onFormatSettled((face, cause) => {
    if (face === lastFormat) {
      return
    }
    lastFormat = face
    feature.send('format-changed', { format: face, cause })
  })

  store.onAlarmFired((alarm) => {
    feature.send('alarm-fired', { id: alarm.id, at: alarm.at, ...(alarm.label !== undefined && { label: alarm.label }) })
    reportAlarmDirty()
  })

  return () => {
    const timer = setInterval(() => {
      feature.send('tick', snapshot())
    }, 1000)
    return () => clearInterval(timer)
  }
}
