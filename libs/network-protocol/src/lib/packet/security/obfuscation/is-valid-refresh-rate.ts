import { getType } from '@hyperfrontend/data-utils'

/**
 * Validates whether the provided refresh rate is valid for packet obfuscation.
 * The refresh rate must be a number greater than or equal to 1.
 *
 * @param refreshRate - The refresh rate value to validate
 * @returns True if the refresh rate is a valid number >= 1, false otherwise
 */
export function isValidRefreshRate(refreshRate: number) {
  return getType(refreshRate) === 'number' && refreshRate >= 1
}
