/**
 * Sanitizers for pasted text before it enters prompt state.
 *
 * @internal
 */

/**
 * Sanitizes pasted text for insertion into a single-line input: interior
 * runs of `\r\n`, `\r`, or `\n` collapse into a single space, leading and
 * trailing newline runs are dropped, and all other C0 control characters
 * (plus DEL) are removed. Pasting therefore never submits or triggers
 * prompt actions.
 *
 * @param raw - Raw pasted text
 * @returns Sanitized single-line text (possibly empty)
 *
 * @example Collapsing a multi-line paste
 * ```typescript
 * sanitizePasteText('first\r\nsecond\n')
 * // => 'first second'
 * ```
 */
export function sanitizePasteText(raw: string): string {
  let out = ''
  let pendingBreak = false
  for (const char of raw) {
    if (char === '\r' || char === '\n') {
      pendingBreak = true
      continue
    }
    const code = char.charCodeAt(0)
    if (code < 0x20 || code === 0x7f) continue
    if (pendingBreak && out.length > 0) {
      out += ' '
    }
    pendingBreak = false
    out += char
  }
  return out
}

/**
 * Extracts the first line of a paste for search-query style inputs: content
 * is cut at the first `\r` or `\n`, then remaining C0 control characters
 * (plus DEL) are removed.
 *
 * @param raw - Raw pasted text
 * @returns Printable characters of the first pasted line
 *
 * @example Keeping only the first pasted line
 * ```typescript
 * firstPasteLine('query\nsecond line')
 * // => 'query'
 * ```
 */
export function firstPasteLine(raw: string): string {
  let out = ''
  for (const char of raw) {
    if (char === '\r' || char === '\n') break
    const code = char.charCodeAt(0)
    if (code < 0x20 || code === 0x7f) continue
    out += char
  }
  return out
}
