/**
 * Doubles a number. Its spec calls it.
 *
 * @param value - The number to double.
 * @returns Twice the value.
 */
export function twice(value: number): number {
  return value * 2
}

/**
 * Never called by any spec, so the file's function coverage stays at half.
 *
 * @returns Zero.
 */
export function never(): number {
  return 0
}
