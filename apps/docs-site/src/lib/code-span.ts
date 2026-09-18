/**
 * Attribute a code span carries when it is allowed to fold across lines.
 *
 * An inline code span is a token by default, kept on one line by the
 * stylesheet: an identifier read across two lines is a different identifier.
 * A span marked with this attribute is a line of code instead, a type
 * expression or a whole statement, and folds at its own spaces, breaking
 * inside a word only when a single word is wider than the column.
 */
export const CODE_WRAP_ATTRIBUTE = 'data-code-wrap'

/** The one value the attribute takes. */
export const CODE_WRAP_FOLD = 'fold'

/**
 * Characters past which a markdown code span is treated as a line of code
 * rather than a token.
 *
 * Calibrated against the narrowest column the site lays prose out in: a
 * 320px phone gives a paragraph 288px, and a list item inside it about 262px,
 * and the site's monospace face at the size inline code takes there advances
 * 8.4px per character. Thirty-two characters plus the chip's padding is 281px,
 * which fits the paragraph and overhangs the list item by a hair on that one
 * width; a phone a generation newer holds the span anywhere. Across the
 * documentation corpus this is also where the spans stop being names and
 * start being expressions: 97% of spans are shorter, and nearly every span
 * past it contains a space to fold at.
 */
export const CODE_SPAN_TOKEN_MAX_LENGTH = 32

/**
 * Whether a code span is long enough to be a line of code rather than a
 * token, and so allowed to fold.
 *
 * @param text - What the span renders, markup flattened away
 * @returns True when the span should carry {@link CODE_WRAP_ATTRIBUTE}
 * @example A short identifier stays a token
 * ```typescript
 * isFoldableCodeSpan('createShell') // false
 * isFoldableCodeSpan("type Mode = 'embedded' | 'dialog' | 'popup'") // true
 * ```
 */
export function isFoldableCodeSpan(text: string): boolean {
  return text.length > CODE_SPAN_TOKEN_MAX_LENGTH
}
