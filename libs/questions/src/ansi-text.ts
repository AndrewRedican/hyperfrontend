/**
 * ANSI-aware text measurement helpers.
 *
 * Display width is measured in Unicode code points with ANSI escape
 * sequences excluded. East-asian wide characters and grapheme clusters are
 * counted as one column each; full terminal-accurate width is out of scope.
 *
 * @internal
 */
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/** Escape character introducing ANSI control sequences. */
export const Esc = '\x1B'

/**
 * Result of matching an ANSI escape sequence at a string position.
 */
export interface AnsiSequenceMatch {
  /** Number of characters the sequence occupies from the start position */
  readonly length: number
  /** False when the sequence is cut off at the end of the string */
  readonly complete: boolean
}

/**
 * Matches the ANSI escape sequence starting at `index`. The character at
 * `index` must be the escape character (`\x1B`); callers check this before
 * calling. Recognizes CSI (`ESC [ ... final`) and SS3 (`ESC O x`) sequences;
 * any other escape is reported as a lone one-character escape.
 *
 * @param text - Text containing the sequence
 * @param index - Position of the escape character
 * @returns Sequence length and whether it is complete
 *
 * @example Matching an arrow-key sequence
 * ```typescript
 * matchAnsiSequence('\x1B[A', 0)
 * // => { length: 3, complete: true }
 * ```
 */
export function matchAnsiSequence(text: string, index: number): AnsiSequenceMatch {
  if (index + 1 >= text.length) {
    return freeze({ length: 1, complete: false })
  }
  const introducer = text.charAt(index + 1)
  if (introducer === '[') {
    return matchCsi(text, index)
  }
  if (introducer === 'O') {
    if (index + 2 >= text.length) {
      return freeze({ length: 2, complete: false })
    }
    return freeze({ length: 3, complete: true })
  }
  return freeze({ length: 1, complete: true })
}

/**
 * Matches a CSI sequence (`ESC [` + parameter/intermediate bytes + final
 * byte in `0x40`-`0x7E`). A byte outside the CSI ranges terminates the match
 * without being consumed so malformed sequences cannot swallow input.
 *
 * @param text - Text containing the sequence
 * @param index - Position of the escape character
 * @returns Sequence length and whether it is complete
 */
function matchCsi(text: string, index: number): AnsiSequenceMatch {
  let i = index + 2
  while (i < text.length) {
    const code = text.charCodeAt(i)
    if (code >= 0x40 && code <= 0x7e) {
      return freeze({ length: i - index + 1, complete: true })
    }
    if (code < 0x20 || code > 0x3f) {
      return freeze({ length: i - index, complete: true })
    }
    i++
  }
  return freeze({ length: text.length - index, complete: false })
}

/**
 * Removes all ANSI escape sequences from a string.
 *
 * @param text - Text possibly containing escape sequences
 * @returns Text with every escape sequence removed
 *
 * @example Stripping color codes
 * ```typescript
 * stripAnsi('\x1B[36mhello\x1B[0m')
 * // => 'hello'
 * ```
 */
export function stripAnsi(text: string): string {
  let out = ''
  let i = 0
  while (i < text.length) {
    if (text.charAt(i) === Esc) {
      i += matchAnsiSequence(text, i).length
      continue
    }
    out += text.charAt(i)
    i++
  }
  return out
}

/**
 * Measures the display width of a string in terminal columns: Unicode code
 * points with ANSI escape sequences excluded. Wide east-asian characters
 * count as one column (documented limitation).
 *
 * @param text - Text to measure
 * @returns Number of display columns
 *
 * @example Measuring styled text
 * ```typescript
 * displayWidth('\x1B[1mhi\x1B[0m')
 * // => 2
 * ```
 */
export function displayWidth(text: string): number {
  return [...stripAnsi(text)].length
}
