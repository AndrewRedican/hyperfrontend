/**
 * Replaces every string, template and comment in a source file with spaces of the same
 * length, so offsets into the result are still valid offsets into the original.
 *
 * This is what keeps a `jest.mock` that is text from being read as one that is code.
 * `tools/eslint-rules` tests a rule *about* `jest.mock` placement, so its specs contain
 * `jest.mock('./a')` at the start of a line inside a template literal. Scanning the raw
 * source would register fourteen replacements for modules that do not exist.
 *
 * @param source - The file's text.
 * @returns The text with those regions blanked.
 */
export function scrubLiterals(source: string): string {
  const out = source.split('')
  const length = source.length
  let index = 0

  /**
   * Blanks a half-open range, leaving newlines so line numbers survive.
   *
   * @param from - First index to blank.
   * @param to - Index to stop before.
   */
  const blank = (from: number, to: number): void => {
    for (let at = from; at < to && at < length; at += 1) {
      if (out[at] !== '\n') out[at] = ' '
    }
  }

  while (index < length) {
    const char = source[index]
    const next = source[index + 1]

    if (char === '/' && next === '/') {
      const end = source.indexOf('\n', index)
      blank(index, end === -1 ? length : end)
      index = end === -1 ? length : end
      continue
    }

    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2)
      blank(index, end === -1 ? length : end + 2)
      index = end === -1 ? length : end + 2
      continue
    }

    if (char === "'" || char === '"' || char === '`') {
      const end = closingQuote(source, index)
      blank(index + 1, end)
      index = end + 1
      continue
    }

    index += 1
  }

  return out.join('')
}

/**
 * Finds the index of the quote closing the literal that starts at `start`.
 *
 * Template literals are treated as opaque all the way to their backtick, interpolations
 * included. A `jest.mock` inside `${...}` would be real code, but no spec in this
 * repository writes one, and treating the whole template as text is the safe direction:
 * it can only miss a mock, never invent one.
 *
 * @param source - The file's text.
 * @param start - Index of the opening quote.
 * @returns Index of the closing quote, or the end of the source when unterminated.
 */
function closingQuote(source: string, start: number): number {
  const quote = source[start]
  for (let at = start + 1; at < source.length; at += 1) {
    const char = source[at]
    if (char === '\\') {
      at += 1
      continue
    }
    if (char === quote) return at
    if (quote !== '`' && char === '\n') return at
  }
  return source.length
}
