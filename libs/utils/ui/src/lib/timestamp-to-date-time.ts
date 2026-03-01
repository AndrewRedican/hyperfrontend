const SHORT = 'short'
const D2 = '2-digit'

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Converts a Unix timestamp to a formatted date-time string.
 *
 * @param timestamp - The Unix timestamp in milliseconds
 * @returns A formatted date-time string (YYYY-MM-DD HH:MM:SS)
 */
export function timestampToDateTime(timestamp: number): string {
  const date = new Date(timestamp)
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
