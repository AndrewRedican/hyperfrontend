/**
 * Time math and formatting for the clock, all through `Intl` — no hand-rolled
 * i18n. Pure functions of (epoch, timezone, locale) so everything is unit-testable.
 */
import type { CoinFace } from '../physics/coin-physics'

/** A wall-clock reading in a timezone. */
export interface WallTime {
  /** Hour of day, 0–23. */
  hour: number
  /** Minute of hour, 0–59. */
  minute: number
  /** Second of minute, 0–59. */
  second: number
  /** Day of month, 1–31. */
  day: number
}

/** The snapshot the contract's `tick` and `time` events carry. */
export interface TimeSnapshot {
  /** Milliseconds since the Unix epoch. */
  epochMs: number
  /** ISO-8601 instant (UTC). */
  iso: string
  /** IANA timezone id the clock displays in. */
  timezone: string
  /** BCP-47 locale used for formatting. */
  locale: string
  /** The face the coin is resting on — the clock's format. */
  format: CoinFace
  /** The time rendered per the locale, timezone, and format. */
  formatted: string
}

/**
 * Reads the wall-clock time of an instant in a timezone.
 *
 * @param epochMs - The instant in epoch milliseconds.
 * @param timezone - IANA timezone id.
 * @returns The hour/minute/second/day shown on a wall clock in that zone.
 *
 * @example Reading Tokyo wall time
 * ```typescript
 * const { hour } = wallTimeIn(Date.UTC(2026, 0, 1, 0, 0), 'Asia/Tokyo') // hour === 9
 * ```
 */
export function wallTimeIn(epochMs: number, timezone: string): WallTime {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    day: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date(epochMs))
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  return { hour: read('hour'), minute: read('minute'), second: read('second'), day: read('day') }
}

/**
 * Formats an instant for display.
 *
 * @param epochMs - The instant in epoch milliseconds.
 * @param timezone - IANA timezone id.
 * @param locale - BCP-47 locale.
 * @param format - The coin face: digital renders seconds, analog renders to the minute.
 * @returns The locale-rendered time string.
 */
export function formatTime(epochMs: number, timezone: string, locale: string, format: CoinFace): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    ...(format === 'digital' && { second: 'numeric' }),
  }).format(new Date(epochMs))
}

/**
 * Formats the date line shown on the digital face.
 *
 * @param epochMs - The instant in epoch milliseconds.
 * @param timezone - IANA timezone id.
 * @param locale - BCP-47 locale.
 * @returns The locale-rendered weekday + date string.
 */
export function formatDate(epochMs: number, timezone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(epochMs))
}

/**
 * Resolves the short timezone label (e.g. `GMT+2`, `PST`) for display.
 *
 * @param epochMs - The instant in epoch milliseconds.
 * @param timezone - IANA timezone id.
 * @param locale - BCP-47 locale.
 * @returns The short zone name.
 */
export function zoneLabel(epochMs: number, timezone: string, locale: string): string {
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    hour: 'numeric',
    timeZoneName: 'short',
  }).formatToParts(new Date(epochMs))
  return parts.find((part) => part.type === 'timeZoneName')?.value ?? timezone
}

/**
 * Builds the contract snapshot for an instant.
 *
 * @param epochMs - The instant in epoch milliseconds.
 * @param timezone - IANA timezone id.
 * @param locale - BCP-47 locale.
 * @param format - The clock's current format (resting face).
 * @returns The {@link TimeSnapshot} carried by `tick` and `time`.
 *
 * @example Building a snapshot for the tick stream
 * ```typescript
 * const snapshot = buildSnapshot(Date.now(), 'Europe/Madrid', 'es-ES', 'analog')
 * ```
 */
export function buildSnapshot(epochMs: number, timezone: string, locale: string, format: CoinFace): TimeSnapshot {
  return {
    epochMs,
    iso: new Date(epochMs).toISOString(),
    timezone,
    locale,
    format,
    formatted: formatTime(epochMs, timezone, locale, format),
  }
}

/**
 * Validates an `HH:mm` alarm time.
 *
 * @param at - The candidate string.
 * @returns `true` for a zero-padded 24-hour `HH:mm`.
 */
export function isValidAlarmTime(at: string): boolean {
  const [hours, minutes, rest] = at.split(':')
  if (hours === undefined || minutes === undefined || rest !== undefined) {
    return false
  }
  if (hours.length !== 2 || minutes.length !== 2 || !/^\d+$/.test(hours) || !/^\d+$/.test(minutes)) {
    return false
  }
  return Number(hours) <= 23 && Number(minutes) <= 59
}

/**
 * Computes when an `HH:mm` alarm next fires in a timezone.
 *
 * The next occurrence is found in wall-clock minutes: the distance from the
 * current wall time to the target, wrapping to tomorrow when the time has
 * passed (a target equal to the current minute is treated as tomorrow).
 *
 * @param at - Alarm time as zero-padded 24-hour `HH:mm`.
 * @param timezone - IANA timezone id the wall time is read in.
 * @param fromEpochMs - The instant to search from.
 * @returns Epoch milliseconds of the next occurrence.
 *
 * @example An alarm later today
 * ```typescript
 * const fires = nextOccurrence('07:30', 'Europe/Madrid', Date.now())
 * ```
 */
export function nextOccurrence(at: string, timezone: string, fromEpochMs: number): number {
  const [hours = '0', minutes = '0'] = at.split(':')
  const target = Number(hours) * 60 + Number(minutes)
  const wall = wallTimeIn(fromEpochMs, timezone)
  const current = wall.hour * 60 + wall.minute
  const deltaMinutes = (((target - current) % 1440) + 1440) % 1440 || 1440
  const startOfMinute = fromEpochMs - wall.second * 1000 - (fromEpochMs % 1000)
  return startOfMinute + deltaMinutes * 60_000
}
