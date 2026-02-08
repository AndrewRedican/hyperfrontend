import { getTimeBasedPassword } from '../get-time-based-password/browser'
import { createTimeBasedPasswords } from './create-get-time-based-passwords'

/**
 * Generates time-based one-time passwords (TOTP) for current, previous, and next time windows (browser implementation).
 * Useful for handling time synchronization issues by providing passwords across adjacent time windows.
 *
 * @param currentUtcTime - The current UTC time for password generation
 * @param baseTimeWindow - The base time window in minutes that defines password validity periods
 * @returns An object containing generator functions for current, previous, and next window passwords
 */
export const getTimeBasedPasswords = createTimeBasedPasswords(getTimeBasedPassword)
