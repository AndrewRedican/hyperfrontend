/**
 * Creates an array of numbers within a specified range (inclusive).
 *
 * @param start - The starting number of the range
 * @param end - The ending number of the range (inclusive)
 * @returns An array containing all numbers from start to end
 * @example
 * ```typescript
 * createRange(1, 5)
 * // => [1, 2, 3, 4, 5]
 *
 * createRange(3, 3)
 * // => [3]
 * ```
 */
export function createRange(start: number, end: number): number[] {
  const range: number[] = []
  for (let i = start; i <= end; i += 1) {
    range.push(i)
  }
  return range
}
