import { createHash } from '../create-hash/node'
import { createGetTimeBasedPassword } from './create-get-time-based-password'

/**
 * Generates a UTC time-based password with configurable variation and window offset.
 * @param currentUtcTime - The current UTC time.
 * @param baseTimeWindow - The base time window in minutes.
 * @param windowOffset - The window offset (-1 for previous, 0 for current, 1 for next).
 * @returns The generated password.
 */
export const getTimeBasedPassword = createGetTimeBasedPassword(createHash)
