import { createHash } from '../create-hash/node'
import { createGetTimeBasedPassword } from './create-get-time-based-password'

/**
 * Generates a UTC time-based one-time password (TOTP) with configurable time window and offset (Node.js implementation).
 * Uses Node.js crypto module for hash generation.
 *
 * @param currentUtcTime - The current UTC time for password generation
 * @param baseTimeWindow - The base time window in minutes that defines password validity period
 * @param windowOffset - The window offset (-1 for previous window, 0 for current, 1 for next window)
 * @returns A promise that resolves to the generated time-based password
 */
export const getTimeBasedPassword = createGetTimeBasedPassword(createHash)
