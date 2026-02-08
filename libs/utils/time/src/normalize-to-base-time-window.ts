/**
 * Normalizes a given time to the nearest base time window.
 *
 * @param time - The Date object to normalize to the nearest time window
 * @param baseTimeWindow - The size of the time window in minutes for normalization
 * @returns A new Date object normalized to the start of the time window
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
