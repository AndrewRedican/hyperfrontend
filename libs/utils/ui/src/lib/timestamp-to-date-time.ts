import { createDate } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'

const SHORT = 'short'
const D2 = '2-digit'

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Converts a Unix timestamp to a formatted date-time string.
 *
 * @param timestamp - The Unix timestamp in milliseconds
 * @returns A formatted date-time string in the user's locale with UTC timezone
 *
 * @example
 * ```typescript
 * timestampToDateTime(1704067200000)
 * // => 'Mon, 01/01/2024, 00:00:00 UTC' (varies by locale)
 * ```
 */
export function timestampToDateTime(timestamp: number): string {
  const date = createDate(timestamp)
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: D2,
    day: D2,
    hour: D2,
    minute: D2,
    second: D2,
    timeZone: 'UTC',
    timeZoneName: SHORT,
    weekday: SHORT,
    hour12: false,
    hourCycle: 'h23',
  }

  const userLanguage = navigator.language || (<any>navigator).userLanguage
  return date.toLocaleString(userLanguage, options)
}
