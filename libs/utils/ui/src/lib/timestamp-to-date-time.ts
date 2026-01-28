const SHORT = 'short'
const D2 = '2-digit'

/* eslint-disable @typescript-eslint/no-explicit-any */
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

  const userLanguage = navigator.language || (navigator as any).userLanguage
  return date.toLocaleString(userLanguage, options)
}
