/**
 * Configuration guards shared by the choice-list prompts.
 *
 * @internal
 */
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { isInteger } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'

/**
 * Rejects a choice-list configuration no keypress could ever resolve: an
 * empty choice list, or a starting index that names no choice. Without the
 * check the prompt paints a frame and waits forever.
 *
 * @param promptName - Prompt name quoted in the error message
 * @param choices - Choices the prompt was configured with
 * @param initial - Indices the prompt is asked to start on
 * @throws {Error} When the choice list is empty, or an initial index is not a whole number inside the list
 *
 * @example Rejecting an empty choice list
 * ```typescript
 * assertResolvableChoices('select', [], [])
 * // => throws Error: select requires at least one choice
 * ```
 *
 * @example Rejecting an index past the end of the list
 * ```typescript
 * assertResolvableChoices('select', [{ label: 'Red', value: 'red' }], [7])
 * // => throws Error: select initial must be an index between 0 and 0, received 7
 * ```
 */
export function assertResolvableChoices(promptName: string, choices: ReadonlyArray<unknown>, initial: ReadonlyArray<number>): void {
  if (choices.length === 0) {
    throw createError(`${promptName} requires at least one choice`)
  }

  for (const index of initial) {
    if (!isInteger(index) || index < 0 || index >= choices.length) {
      throw createError(`${promptName} initial must be an index between 0 and ${choices.length - 1}, received ${index}`)
    }
  }
}
