/**
 * Replaces all occurrences of a character in a string.
 * Uses character-by-character iteration to avoid regex (ReDoS-safe).
 *
 * @param input - The input string
 * @param target - The character to replace
 * @param replacement - The replacement character
 * @returns String with all occurrences replaced
 */
export function replaceChar(input: string, target: string, replacement: string): string {
  const result: string[] = []

  for (let i = 0; i < input.length; i++) {
    result.push(input[i] === target ? replacement : input[i])
  }

  return result.join('')
}

/**
 * Replaces all hyphens with spaces.
 * Convenience wrapper for normalizing footer keys.
 *
 * @param input - The input string
 * @returns String with hyphens replaced by spaces
 */
export function hyphenToSpace(input: string): string {
  return replaceChar(input, '-', ' ')
}
