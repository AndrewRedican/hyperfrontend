import type { HashAlgorithm } from '../create-hash/model'
import { getType } from '@hyperfrontend/data-utils'
import { randomPseudoTimeBased } from '@hyperfrontend/random-generator-utils'
import { normalizeToBaseTimeWindow } from '@hyperfrontend/time-utils'

export function createGetTimeBasedPassword(
  createHash: (data: string, algorithm?: HashAlgorithm) => Promise<string>
): (currentUtcTime: Date, baseTimeWindow: number, windowOffset?: -1 | 0 | 1) => Promise<string> {
  return async function getTimeBasedPassword(currentUtcTime, baseTimeWindow, windowOffset = 0): Promise<string> {
    if (getType(windowOffset) !== 'number' || windowOffset < -1 || 1 < windowOffset) {
      throw new Error('Window offset must be -1, 0, or 1.')
    }
    const offsetTime = new Date(currentUtcTime.getTime() + windowOffset * baseTimeWindow * 60000)

    return await createHash(randomPseudoTimeBased(normalizeToBaseTimeWindow(offsetTime, baseTimeWindow)).toString())
  }
}
