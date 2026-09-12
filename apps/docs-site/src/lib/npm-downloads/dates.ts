import { createDate, dateUTC } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { floor } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { parseInt as parseInteger } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'

/** Milliseconds in one calendar day. */
const DAY_MS = 86_400_000

/** Shape every day in the dataset is written in, the same one npm answers with. */
const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * A calendar day as npm names it: `YYYY-MM-DD`, always UTC.
 *
 * Download counts are per UTC day and the dataset never carries a time, so a
 * day is a string rather than a `Date`: it sorts lexically, compares with `<`,
 * and survives a round trip through NDJSON unchanged.
 */
export type Day = string

/**
 * Whether a string is a well-formed calendar day that exists.
 *
 * The pattern alone accepts `2026-02-30`; the round trip through UTC rejects
 * it, because a date built from an impossible day normalises to a different
 * one and no longer formats back to its input.
 *
 * @param value - The string to test
 * @returns True when the value is a real `YYYY-MM-DD` day
 *
 * @example Telling a real day from a malformed one
 * ```typescript
 * isDay('2026-06-28') // true
 * isDay('2026-02-30') // false
 * isDay('28/06/2026') // false
 * ```
 */
export function isDay(value: string): value is Day {
  const match = DAY_PATTERN.exec(value)
  if (match === null) return false
  const [, year, month, day] = match
  const time = dateUTC(parseInteger(year, 10), parseInteger(month, 10) - 1, parseInteger(day, 10))
  return formatDay(time) === value
}

/**
 * Format a UTC timestamp as a calendar day.
 *
 * @param time - Milliseconds since the epoch
 * @returns The UTC day the timestamp falls on
 *
 * @example Naming today
 * ```typescript
 * formatDay(dateNow()) // '2026-09-12'
 * ```
 */
export function formatDay(time: number): Day {
  return createDate(time).toISOString().slice(0, 10)
}

/**
 * The UTC midnight a day begins at, in milliseconds since the epoch.
 *
 * @param day - A calendar day
 * @returns The timestamp of its start
 * @throws {Error} When the day is malformed, since arithmetic on it would be silent nonsense
 *
 * @example
 * ```typescript
 * dayToTime('1970-01-02') // 86400000
 * ```
 */
export function dayToTime(day: Day): number {
  if (!isDay(day)) throw createError(`Not a calendar day: ${day}`)
  return dateUTC(parseInteger(day.slice(0, 4), 10), parseInteger(day.slice(5, 7), 10) - 1, parseInteger(day.slice(8, 10), 10))
}

/**
 * The day a number of days after another.
 *
 * @param day - The day to count from
 * @param days - How many days forward, or backward when negative
 * @returns The resulting day
 *
 * @example Stepping across a month boundary
 * ```typescript
 * addDays('2026-06-30', 1) // '2026-07-01'
 * addDays('2026-07-01', -1) // '2026-06-30'
 * ```
 */
export function addDays(day: Day, days: number): Day {
  return formatDay(dayToTime(day) + days * DAY_MS)
}

/**
 * How many days lie between two days, inclusive of both.
 *
 * @param start - The first day
 * @param end - The last day
 * @returns The count, one when the days are the same, zero or negative when `end` precedes `start`
 *
 * @example A week
 * ```typescript
 * daysInclusive('2026-09-01', '2026-09-07') // 7
 * ```
 */
export function daysInclusive(start: Day, end: Day): number {
  return floor((dayToTime(end) - dayToTime(start)) / DAY_MS) + 1
}

/**
 * Every day from one to another, inclusive, in order.
 *
 * @param start - The first day
 * @param end - The last day
 * @returns The days, empty when `end` precedes `start`
 *
 * @example
 * ```typescript
 * daysBetween('2026-09-01', '2026-09-03') // ['2026-09-01', '2026-09-02', '2026-09-03']
 * ```
 */
export function daysBetween(start: Day, end: Day): Day[] {
  const days: Day[] = []
  for (let time = dayToTime(start), last = dayToTime(end); time <= last; time += DAY_MS) {
    days.push(formatDay(time))
  }
  return days
}
