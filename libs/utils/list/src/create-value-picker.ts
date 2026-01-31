export interface ValuePicker {
  current: () => string
  next: () => string
}

/**
 * Creates a value picker that cycles through a list of string values.
 *
 * @param values - The array of string values to cycle through
 * @returns A ValuePicker instance with current and next methods
 */
export function createValuePicker(values: string[]): ValuePicker {
  if (!values || !values.length) {
    throw new Error('Expected values not to be an empty list.')
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
