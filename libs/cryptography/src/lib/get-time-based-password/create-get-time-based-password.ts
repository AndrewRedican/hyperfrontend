import type { HashAlgorithm } from '../create-hash/model'
import { getType } from '@hyperfrontend/data-utils'
import { createDate } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { randomPseudoTimeBased } from '@hyperfrontend/random-generator-utils'
import { normalizeToBaseTimeWindow } from '@hyperfrontend/time-utils'

/**
 * Creates a time-based one-time password (TOTP) generator function.
 * Generates passwords that change based on time windows, supporting previous/current/next window offsets.
 *
 * @param createHash - Function to create cryptographic hashes
 * @returns A function that generates time-based passwords
 */
export function createGetTimeBasedPassword(
  createHash: (data: string, algorithm?: HashAlgorithm) => Promise<string>
): (currentUtcTime: Date, baseTimeWindow: number, windowOffset?: -1 | 0 | 1) => Promise<string> {
  return async function getTimeBasedPassword(currentUtcTime, baseTimeWindow, windowOffset = 0): Promise<string> {
    if (getType(windowOffset) !== 'number' || windowOffset < -1 || 1 < windowOffset) {
      throw createError('Window offset must be -1, 0, or 1.')
    }
    const offsetTime = createDate(currentUtcTime.getTime() + windowOffset * baseTimeWindow * 60000)

    return await createHash(randomPseudoTimeBased(normalizeToBaseTimeWindow(offsetTime, baseTimeWindow)).toString())
  }
}
