/**
 * Whether the engine accepts a pattern with its flags, asked of the engine itself.
 *
 * @module regex/validate
 */

import { createRegExp } from '@hyperfrontend/immutable-api-utils/built-in-copy/regexp'

/**
 * Validates a pattern with its flags by constructing the regular expression.
 *
 * @param pattern - The pattern text
 * @param flags - The flags passed to the constructor
 * @returns The constructor's message when it refuses the pair, or null when it accepts it
 *
 * @example Ask the engine about a pattern and its flags
 * ```ts
 * validate('(?<year>\\d{4})', 'u') // => null
 * validate('a{2,1}', '')
 * // => 'Invalid regular expression: /a{2,1}/: numbers out of order in {} quantifier'
 * //    (the engine's own wording)
 * ```
 */
export function validate(pattern: string, flags: string): string | null {
  try {
    // why: the pattern under test is the input; nothing is ever matched against it.
    // lint-disable-next-line no-unsafe-regex
    createRegExp(pattern, flags)
    return null
  } catch (error) {
    return (error as Error).message
  }
}
