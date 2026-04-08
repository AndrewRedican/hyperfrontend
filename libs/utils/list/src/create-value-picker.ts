import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/**
 * Interface for cycling through a list of values.
 */
export interface ValuePicker {
  /** Returns the current value without advancing. */
  current: () => string
  /** Advances and returns the next value, cycling at end. */
  next: () => string
}

/**
 * Creates a value picker that cycles through a list of string values.
 *
 * @param values - The array of string values to cycle through
 * @returns A ValuePicker instance with current and next methods
 * @example
 * ```typescript
 * const colorPicker = createValuePicker(['red', 'green', 'blue'])
 *
 * colorPicker.current() // => 'red'
 * colorPicker.next()    // => 'red' (first call initializes)
 * colorPicker.next()    // => 'green'
 * colorPicker.next()    // => 'blue'
 * colorPicker.next()    // => 'red' (cycles back)
 * ```
 */
export function createValuePicker(values: string[]): ValuePicker {
  if (!values || !values.length) {
    throw createError('Expected values not to be an empty list.')
  }
  let index = -1
  /**
   * Returns the current value without advancing the picker.
   *
   * @returns The current value in the list
   */
  function current() {
    if (index < 0) index = 0
    return values[index]
  }
  /**
   * Advances to and returns the next value, cycling back to the start when reaching the end.
   *
   * @returns The next value in the list
   */
  function next() {
    if (index < 0) return current()
    index = ++index < values.length ? index : 0
    return values[index]
  }
  return {
    current: current,
    next: next,
  }
}
