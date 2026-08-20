/**
 * Result of {@link parseBreakingFromItem}: the breaking flag plus the item
 * text left once its leading markers are removed.
 */
export type BreakingFromItem = {
  /** Whether the item opened with at least one breaking marker */
  breaking: boolean
  /** The item text with every leading breaking marker stripped */
  text: string
}

/**
 * Parses the breaking-change markers a changelog item can open with, lifting
 * them out of the text and onto a flag. Serializing re-emits exactly one
 * marker, so an item survives a parse then serialize round trip unchanged; a
 * run of markers left behind by earlier round trips collapses back to a single
 * flag.
 *
 * Recognized openers, case-insensitive and repeatable: `**BREAKING**`,
 * `**BREAKING:**`, `[BREAKING]`, `⚠️ BREAKING:`, a bare `BREAKING:`, and the
 * `BREAKING CHANGE`/`BREAKING CHANGES` spelling of each. A bare mention needs
 * its colon to count, so prose such as `Breaking apart the parser` is left
 * alone. Scanning is character-by-character to stay ReDoS-safe.
 *
 * @param text - The changelog item text, without its list marker
 * @returns The breaking flag and the text that follows the markers
 *
 * @example Lifting markers out of item text
 * ```typescript
 * parseBreakingFromItem('**BREAKING** **BREAKING:** drop the sync open')
 * // => { breaking: true, text: 'drop the sync open' }
 *
 * parseBreakingFromItem('add a retry budget')
 * // => { breaking: false, text: 'add a retry budget' }
 * ```
 */
export function parseBreakingFromItem(text: string): BreakingFromItem {
  const trimmed = text.trim()
  let pos = 0
  let breaking = false

  while (pos < trimmed.length) {
    const next = matchBreakingMarker(trimmed, pos)
    if (next === -1) break
    breaking = true
    pos = next
  }

  return { breaking, text: trimmed.slice(pos) }
}

/**
 * Matches a single breaking marker, tolerating the bold, bracketed,
 * warning-sign, and bare spellings plus any spaces that trail it.
 *
 * @param text - The text being scanned
 * @param start - Index the marker has to start at
 * @returns The index just past the marker, or -1 when none matches
 */
function matchBreakingMarker(text: string, start: number): number {
  let pos = start
  let closer = ''

  if (text.startsWith('**', pos)) {
    closer = '**'
    pos += 2
  } else if (text[pos] === '[') {
    closer = ']'
    pos += 1
  } else if (text[pos] === '⚠') {
    pos += 1
    // why: the warning sign is usually written with an emoji variation selector
    if (text[pos] === '\uFE0F') pos += 1
    while (text[pos] === ' ') pos++
  }

  pos = matchBreakingWord(text, pos)
  if (pos === -1) return -1

  const colon = text[pos] === ':'
  if (colon) pos += 1

  if (closer.length > 0) {
    if (!text.startsWith(closer, pos)) return -1
    pos += closer.length
    if (text[pos] === ':') pos += 1
  } else if (!colon) {
    return -1
  }

  while (text[pos] === ' ') pos++

  return pos
}

/**
 * Matches the literal `BREAKING`, optionally continued as `BREAKING CHANGE`
 * or `BREAKING CHANGES`.
 *
 * @param text - The text being scanned
 * @param start - Index the word has to start at
 * @returns The index just past the word, or -1 when it does not match
 */
function matchBreakingWord(text: string, start: number): number {
  const afterWord = matchLiteral(text, start, 'breaking')
  if (afterWord === -1) return -1

  const afterChanges = matchLiteral(text, afterWord, ' changes')
  if (afterChanges !== -1) return afterChanges

  const afterChange = matchLiteral(text, afterWord, ' change')
  if (afterChange !== -1) return afterChange

  return afterWord
}

/**
 * Matches a lowercase literal at a position, ignoring case.
 *
 * @param text - The text being scanned
 * @param start - Index the literal has to start at
 * @param literal - The lowercase literal to match against
 * @returns The index just past the literal, or -1 when it does not match
 */
function matchLiteral(text: string, start: number, literal: string): number {
  if (start + literal.length > text.length) return -1

  for (let i = 0; i < literal.length; i++) {
    if (text[start + i]?.toLowerCase() !== literal[i]) return -1
  }

  return start + literal.length
}
