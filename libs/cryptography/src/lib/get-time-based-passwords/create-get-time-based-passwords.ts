import type { TimeBasedPasswordGenerators } from './model'

/**
 * Creates a factory function that generates time-based password generators for multiple time windows.
 * Returns a frozen object with methods to generate passwords for current, previous, and next time windows.
 *
 * @param getTimeBasedPassword - Function to generate a single time-based password with window offset
 * @returns A function that creates password generators for adjacent time windows
 */
export function createTimeBasedPasswords(
  getTimeBasedPassword: (currentUtcTime: Date, baseTimeWindow: number, windowOffset?: -1 | 0 | 1) => Promise<string>
): (currentUtcTime: Date, baseTimeWindow: number) => Readonly<TimeBasedPasswordGenerators> {
  return function getTimeBasedPasswords(currentUtcTime, baseTimeWindow) {
    const current = () => getTimeBasedPassword(currentUtcTime, baseTimeWindow, 0)
    const previous = () => getTimeBasedPassword(currentUtcTime, baseTimeWindow, -1)
    const next = () => getTimeBasedPassword(currentUtcTime, baseTimeWindow, 1)
    // Freeze to prevent runtime modification of password generator methods
    return Object.freeze({ current, previous, next })
  }
}
