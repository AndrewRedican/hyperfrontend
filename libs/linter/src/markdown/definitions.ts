/**
 * Link reference definitions and footnote definitions: `[label]: destination "title"` at the
 * start of a paragraph, and `[^label]:` opening a footnote. Labels are normalised to the
 * identifier references are matched by.
 *
 * @module markdown/definitions
 */

import type { Segment } from './blocks'
import { decodeText } from './entities'

/** A definition taken from a paragraph. */
export interface Definition {
  /** The normalised label. */
  readonly identifier: string
  /** The destination, decoded. */
  readonly url: string
  /** The title, decoded, or null. */
  readonly title: string | null
  /** The offset of the opening bracket. */
  readonly start: number
  /** The offset after the title or destination. */
  readonly end: number
}

/** What was found at the start of a paragraph. */
export interface TakenDefinitions {
  /** The definitions, in order. */
  readonly definitions: readonly Definition[]
  /** The lines that remain paragraph content. */
  readonly rest: readonly Segment[]
}

/** A destination or title with where it ends. */
interface Taken {
  /** The decoded value. */
  readonly value: string
  /** The offset after the raw value. */
  readonly end: number
}

/**
 * The identifier of a label: whitespace collapsed, ends trimmed, case folded.
 *
 * @param label - The text between the brackets
 * @returns The identifier
 *
 * @example Match a reference to its definition label
 * ```ts
 * normaliseLabel('  Getting\n  Started ') // => 'getting started'
 * ```
 */
export function normaliseLabel(label: string): string {
  return label
    .replace(/[\t\n\r ]+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * The label a bracket opens, when it is one: up to 999 characters with no unescaped bracket.
 *
 * @param text - The document
 * @param at - The opening bracket
 * @returns The offset after the closing bracket, or -1
 *
 * @example Find where a label closes
 * ```ts
 * labelEnd('[docs][api]', 0) // => 6
 * labelEnd('[ ]', 0) // => -1 (blank labels are not labels)
 * labelEnd('[a[b]', 0) // => -1 (unescaped nested bracket)
 * ```
 */
export function labelEnd(text: string, at: number): number {
  let index = at + 1
  while (index < text.length && index - at < 1000) {
    const char = text[index]
    if (char === '\\') index += 2
    else if (char === '[') return -1
    else if (char === ']') return normaliseLabel(text.slice(at + 1, index)) === '' ? -1 : index + 1
    else index += 1
  }
  return -1
}

/**
 * A link destination at an offset: angle-bracketed, or a run without spaces and with balanced
 * parentheses.
 *
 * @param text - The document
 * @param at - Where it would start
 * @param limit - The offset it must not reach
 * @returns The destination, or null
 *
 * @example Read an angle-bracketed or a bare destination
 * ```ts
 * const quoted = '<./My Guide.md> rest'
 * takeDestination(quoted, 0, quoted.length)
 * // => { value: './My Guide.md', end: 15 }
 * const bare = 'https://a.dev/x_(y) "T"'
 * takeDestination(bare, 0, bare.length)
 * // => { value: 'https://a.dev/x_(y)', end: 19 }
 * ```
 */
export function takeDestination(text: string, at: number, limit: number): Taken | null {
  if (text[at] === '<') {
    let index = at + 1
    while (index < limit && text[index] !== '>' && text[index] !== '<' && text[index] !== '\n') index += text[index] === '\\' ? 2 : 1
    return text[index] === '>' && index < limit ? { value: decodeText(text.slice(at + 1, index)), end: index + 1 } : null
  }
  let depth = 0
  let index = at
  for (; index < limit; index += 1) {
    const char = text[index]
    if (char === '\\' && index + 1 < limit) index += 1
    else if (char === '(') depth += 1
    else if (char === ')') {
      if (depth === 0) break
      depth -= 1
    } else if (char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127) break
  }
  return index === at || depth !== 0 ? null : { value: decodeText(text.slice(at, index)), end: index }
}

/**
 * A link title at an offset, in double quotes, single quotes or parentheses.
 *
 * @param text - The document
 * @param at - Where it would start
 * @param limit - The offset it must not reach
 * @returns The title, or null
 *
 * @example Read a quoted title, decoding entities
 * ```ts
 * const source = '"Read &amp; learn" tail'
 * takeTitle(source, 0, source.length)
 * // => { value: 'Read & learn', end: 18 }
 * takeTitle('"open', 0, 5) // => null (never closed)
 * ```
 */
export function takeTitle(text: string, at: number, limit: number): Taken | null {
  const open = text[at]
  const close = open === '"' ? '"' : open === "'" ? "'" : open === '(' ? ')' : ''
  if (close === '') return null
  let index = at + 1
  while (index < limit && text[index] !== close) {
    if (text[index] === '\\') index += 1
    index += 1
  }
  return index < limit ? { value: decodeText(text.slice(at + 1, index)), end: index + 1 } : null
}

/**
 * The offset after the whitespace at an offset; a paragraph holds no blank line, so at most one
 * line ending is crossed.
 *
 * @param text - The document
 * @param at - Where to start
 * @param limit - The offset not to pass
 * @returns The offset of the next character that is not whitespace, or the limit
 */
function skipWhitespace(text: string, at: number, limit: number): number {
  let index = at
  while (index < limit && /\s/.test(text[index])) index += 1
  return index
}

/**
 * Takes the definitions a paragraph opens with, leaving the lines that remain content.
 *
 * @param text - The document
 * @param lines - The paragraph's lines
 * @returns The definitions and the remaining lines
 *
 * @example Separate a definition from the paragraph after it
 * ```ts
 * const text = '[home]: https://example.com "Home"\nWelcome back.'
 * const lines = [{ start: 0, end: 34 }, { start: 35, end: 48 }]
 * const taken = takeDefinitions(text, lines)
 * taken.definitions[0]
 * // => { identifier: 'home', url: 'https://example.com',
 * //      title: 'Home', start: 0, end: 34 }
 * taken.rest // => [{ start: 35, end: 48 }]
 * ```
 */
export function takeDefinitions(text: string, lines: readonly Segment[]): TakenDefinitions {
  const definitions: Definition[] = []
  let remaining = lines
  while (remaining.length > 0) {
    const first = remaining[0]
    const limit = remaining[remaining.length - 1].end
    const end = text[first.start] === '[' ? labelEnd(text, first.start) : -1
    if (end === -1 || text[end] !== ':') break
    const destinationAt = skipWhitespace(text, end + 1, limit)
    const destination = takeDestination(text, destinationAt, limit)
    if (destination === null) break
    let last = destination.end
    let title: Taken | null = null
    const titleAt = skipWhitespace(text, destination.end, limit)
    if (titleAt > destination.end) {
      title = takeTitle(text, titleAt, limit)
      if (title !== null && !/^[ \t]*(\n|$)/.test(text.slice(title.end, limit + 1))) title = null
      if (title !== null) last = title.end
    }
    if (!/^[ \t]*(\n|$)/.test(text.slice(last, limit + 1))) break
    definitions.push({
      identifier: normaliseLabel(text.slice(first.start + 1, end - 1)),
      url: destination.value,
      title: title === null ? null : title.value,
      start: first.start,
      end: last,
    })
    remaining = remaining.filter((line) => line.end > last)
  }
  return { definitions, rest: remaining }
}
