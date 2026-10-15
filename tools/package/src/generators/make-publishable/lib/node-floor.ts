import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/** The Node.js range a package declares when it declares none of its own. */
export const DEFAULT_NODE_ENGINE = '>=18.0.0'

/** The npm range a package declares when it declares none of its own. */
export const DEFAULT_NPM_ENGINE = '>=8.0.0'

/**
 * Whether a character is a decimal digit.
 *
 * @param character - One character
 * @returns True for `0` through `9`
 */
function isDigit(character: string): boolean {
  return character >= '0' && character <= '9'
}

/**
 * The lowest version an engines range names: the first version number in it.
 *
 * @param range - An engines range such as `>=22.18.0`
 * @returns The version, `22.18.0`
 * @throws {Error} When the range names no version at all
 *
 * @example
 * ```typescript
 * nodeFloorOf('>=18.0.0') // '18.0.0'
 * nodeFloorOf('^20.10 || >=22') // '20.10'
 * ```
 */
export function nodeFloorOf(range: string): string {
  let start = 0
  while (start < range.length && !isDigit(range.charAt(start))) start++
  if (start === range.length) throw createError(`engines.node "${range}" names no version, so no floor can be read from it`)
  let end = start
  while (end < range.length && (isDigit(range.charAt(end)) || range.charAt(end) === '.')) end++
  let floor = range.slice(start, end)
  while (floor.endsWith('.')) floor = floor.slice(0, -1)
  return floor
}

/**
 * A version without the trailing zero segments a reader does not need.
 *
 * @param version - A version such as `22.18.0`
 * @returns The version with trailing `.0` segments dropped, `22.18`
 *
 * @example
 * ```typescript
 * compactVersion('18.0.0') // '18'
 * compactVersion('20.10.5') // '20.10.5'
 * ```
 */
export function compactVersion(version: string): string {
  const segments = version.split('.')
  while (segments.length > 1 && segments[segments.length - 1] === '0') segments.pop()
  return segments.join('.')
}
