import { max, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** How long a completed command stays before the next one is typed. */
export const DWELL_MS = 5000

/** How long typing one command takes, whatever its length. */
export const TYPING_MS = 700

/** The slowest a character may arrive, so a short command still reads as typed rather than as pasted. */
export const MIN_KEYSTROKE_MS = 22

/**
 * How long each keystroke of a command takes, so the whole command lands in {@link TYPING_MS}.
 *
 * @param length - Characters in the command
 * @returns Milliseconds between characters
 *
 * @example
 * ```typescript
 * keystrokeInterval(21) // 33
 * keystrokeInterval(3) // 233
 * ```
 */
export function keystrokeInterval(length: number): number {
  return max(MIN_KEYSTROKE_MS, round(TYPING_MS / max(1, length)))
}

/**
 * The number of characters shown after one more keystroke, capped at the whole command.
 *
 * @param shown - Characters shown now
 * @param length - Characters in the command
 * @returns Characters shown next
 *
 * @example
 * ```typescript
 * nextKeystroke(3, 10) // 4
 * nextKeystroke(10, 10) // 10
 * ```
 */
export function nextKeystroke(shown: number, length: number): number {
  return shown >= length ? length : shown + 1
}

/**
 * The index of the command after this one, wrapping to the first.
 *
 * @param index - The current command
 * @param count - How many there are
 * @returns The next index
 *
 * @example
 * ```typescript
 * nextCommand(2, 3) // 0
 * ```
 */
export function nextCommand(index: number, count: number): number {
  return count === 0 ? 0 : (index + 1) % count
}

/** Anything with text, which is all the cut needs to know about a token. */
export interface Textual {
  /** The text */
  content: string
}

/**
 * The visible prefix of a line of tokens, cut at a number of characters.
 *
 * A token that straddles the cut is shortened rather than dropped, so a
 * command being typed shows every character up to the cut in the colour
 * it will have when the token is complete.
 *
 * @param tokens - The line's tokens
 * @param shown - Characters to show
 * @returns The tokens up to the cut, the last one shortened if need be
 *
 * @example
 * ```typescript
 * visibleTokens([{ content: 'npx', style: '' }, { content: ' nx', style: '' }], 4)
 * // [{ content: 'npx', style: '' }, { content: ' ', style: '' }]
 * ```
 */
export function visibleTokens<T extends Textual>(tokens: readonly T[], shown: number): T[] {
  const visible: T[] = []
  let remaining = shown
  for (const token of tokens) {
    if (remaining <= 0) break
    if (token.content.length <= remaining) {
      visible.push(token)
      remaining -= token.content.length
    } else {
      visible.push({ ...token, content: token.content.slice(0, remaining) })
      remaining = 0
    }
  }
  return visible
}
