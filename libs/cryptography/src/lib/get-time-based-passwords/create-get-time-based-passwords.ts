import type { TimeBasedPasswordGenerators } from './model'

export function createTimeBasedPasswords(
  getTimeBasedPassword: (currentUtcTime: Date, baseTimeWindow: number, windowOffset?: -1 | 0 | 1) => Promise<string>
): (currentUtcTime: Date, baseTimeWindow: number) => TimeBasedPasswordGenerators {
  return function getTimeBasedPasswords(currentUtcTime, baseTimeWindow) {
    const current = () => getTimeBasedPassword(currentUtcTime, baseTimeWindow, 0)
    const previous = () => getTimeBasedPassword(currentUtcTime, baseTimeWindow, -1)
    const next = () => getTimeBasedPassword(currentUtcTime, baseTimeWindow, 1)
    return { current, previous, next }
  }
}
