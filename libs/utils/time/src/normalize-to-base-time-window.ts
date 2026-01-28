/**
 * Normalizes a given time to the nearest base time window.
 * @param time - The time to normalize.
 * @param baseTimeWindow - The base time window in minutes.
 * @returns The normalized time.
 */
export function normalizeToBaseTimeWindow(time: Date, baseTimeWindow: number): Date {
  if (!time || !(time instanceof Date) || isNaN(time.getTime())) {
    throw new Error('Invalid time input')
  }

  if (baseTimeWindow <= 0) {
    throw new Error('Base time window must be positive')
  }

  const timeInMs = time.getTime()
  const windowInMs = baseTimeWindow * 60 * 1000
  const normalizedTimeInMs = Math.floor(timeInMs / windowInMs) * windowInMs
  return new Date(normalizedTimeInMs)
}
