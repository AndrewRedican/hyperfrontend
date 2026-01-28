import { getTimeBasedPassword } from '../get-time-based-password/browser'
import { createTimeBasedPasswords } from './create-get-time-based-passwords'

/**
 * Generates time-based passwords for the current, previous, and next time windows.
 * This function is useful for handling scenarios where time synchronization might
 * not be perfect, and there's a need to access passwords across adjacent time windows.
 *
 * @param currentUtcTime - The current UTC time.
 * @param baseTimeWindow - The base time window in minutes.
 * @returns An object containing methods to generate passwords for the current,
 *          previous, and next time windows.
 */
export const getTimeBasedPasswords = createTimeBasedPasswords(getTimeBasedPassword)
