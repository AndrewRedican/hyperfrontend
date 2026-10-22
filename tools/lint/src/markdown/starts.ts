/**
 * What begins and ends the leaf blocks: the recognisers the block parser asks about one line at a
 * time. Each reads the text from an offset and answers with what it found, never with a node.
 *
 * @module markdown/starts
 */

import type { MarkdownAlign } from './model.ts'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { closingTagEnd, openTagEnd } from './scanners.ts'

/** The width of an indentation and where it stops. */
export interface Indent {
  /** The columns the whitespace spans, tabs reaching the next multiple of four. */
  readonly width: number
  /** The offset of the first character that is not a space or tab. */
  readonly end: number
}

/** An opening fence. */
export interface Fence {
  /** The fence character, a backtick or a tilde. */
  readonly char: string
  /** How many of it open the block. */
  readonly length: number
  /** The columns of indentation before the fence, removed from each content line. */
  readonly indent: number
  /** The language the info string names, or empty. */
  readonly lang: string
  /** The rest of the info string, or empty. */
  readonly meta: string
}

/** A list marker. */
export interface ListMarker {
  /** The marker's last character: a bullet, or the delimiter after a number. */
  readonly bullet: string
  /** Whether the marker is a number. */
  readonly ordered: boolean
  /** The number, for an ordered marker. */
  readonly start: number
  /** The offset after the marker. */
  readonly markerEnd: number
  /** The offset where the item's content begins on this line. */
  readonly contentStart: number
  /** The columns from the marker's first character to the content, which continuation lines must reach. */
  readonly contentIndent: number
  /** Whether the marker has no content after it on this line. */
  readonly empty: boolean
}

/** An ATX heading's level and content. */
export interface HeadingStart {
  /** The level, 1 to 6. */
  readonly depth: number
  /** The offset of the content's first character. */
  readonly contentStart: number
  /** The offset after the content's last character, closing sequence and whitespace excluded. */
  readonly contentEnd: number
}

/** One cell of a table row. */
export interface CellSpan {
  /** The cell's first character: its leading pipe, or the row's start. */
  readonly start: number
  /** The offset before the next cell's pipe, or the row's end. */
  readonly end: number
  /** The first character of the trimmed content. */
  readonly contentStart: number
  /** The offset after the trimmed content. */
  readonly contentEnd: number
}

/** The tags of an HTML block that ends at a blank line. */
const BLOCK_TAGS = createSet(
  'address article aside base basefont blockquote body caption center col colgroup dd details dialog dir div dl dt fieldset figcaption figure footer form frame frameset h1 h2 h3 h4 h5 h6 head header hr html iframe legend li link main menu menuitem nav noframes ol optgroup option p param search section summary table tbody td tfoot th thead title tr track ul'.split(
    ' '
  )
)

/** The tags of an HTML block that ends at its own closing tag. */
const RAW_TAGS = ['pre', 'script', 'style', 'textarea']

// why: the two characters Markdown counts as indentation.
const isSpace = (char: string | undefined): boolean => char === ' ' || char === '\t'

/**
 * The indentation at an offset.
 *
 * @param text - The document
 * @param at - Where the line's remaining text starts
 * @param column - The column `at` sits in, for tab stops
 * @returns Its width and end
 */
export function indentOf(text: string, at: number, column = 0): Indent {
  let width = 0
  let end = at
  for (;;) {
    const char = text[end]
    if (char === ' ') width += 1
    else if (char === '\t') width += 4 - ((column + width) % 4)
    else return { width, end }
    end += 1
  }
}

/**
 * The offset after as many spaces and tabs as reach a number of columns.
 *
 * @param text - The document
 * @param at - Where the whitespace starts
 * @param columns - How many columns to consume
 * @returns The offset after them
 */
export function consumeColumns(text: string, at: number, columns: number): number {
  let width = 0
  let end = at
  while (width < columns && isSpace(text[end])) {
    width += text[end] === '\t' ? 4 - (width % 4) : 1
    end += 1
  }
  return end
}

/**
 * Whether only whitespace remains between an offset and the line's end.
 *
 * @param text - The document
 * @param at - Where to look from
 * @param lineEnd - The offset the line ends at, before its line break
 * @returns True for a blank remainder
 */
export function isBlank(text: string, at: number, lineEnd: number): boolean {
  for (let index = at; index < lineEnd; index += 1) if (!isSpace(text[index])) return false
  return true
}

/**
 * The ATX heading a line opens with, as its level and the span of its content.
 *
 * @param text - The document
 * @param at - The first `#`
 * @param lineEnd - The offset the line ends at, before its line break
 * @returns The depth with the content's start and end, or null
 */
export function atxHeading(text: string, at: number, lineEnd: number): HeadingStart | null {
  let depth = 0
  while (text[at + depth] === '#') depth += 1
  if (depth === 0 || depth > 6 || (at + depth < lineEnd && !isSpace(text[at + depth]))) return null
  let contentStart = at + depth
  while (isSpace(text[contentStart])) contentStart += 1
  let contentEnd = lineEnd
  while (contentEnd > contentStart && isSpace(text[contentEnd - 1])) contentEnd -= 1
  let closing = contentEnd
  while (closing > contentStart && text[closing - 1] === '#') closing -= 1
  if (closing === contentStart || (closing < contentEnd && isSpace(text[closing - 1]))) {
    contentEnd = closing
    while (contentEnd > contentStart && isSpace(text[contentEnd - 1])) contentEnd -= 1
  }
  return { depth, contentStart, contentEnd }
}

/**
 * The code fence a line opens.
 *
 * @param text - The document
 * @param at - The first fence character
 * @param lineEnd - The offset the line ends at, before its line break
 * @param indent - The columns of indentation before it
 * @returns The fence, or null when the line opens none
 */
export function openingFence(text: string, at: number, lineEnd: number, indent: number): Fence | null {
  const char = text[at]
  if (indent > 3 || (char !== '`' && char !== '~')) return null
  let length = 0
  while (text[at + length] === char) length += 1
  if (length < 3) return null
  const info = text.slice(at + length, lineEnd).trim()
  if (char === '`' && info.includes('`')) return null
  const space = info.search(/\s/)
  const lang = space === -1 ? info : info.slice(0, space)
  return { char, length, indent, lang, meta: space === -1 ? '' : info.slice(space).trim() }
}

/**
 * Whether a line closes a fence.
 *
 * @param text - The document
 * @param at - Where the line's remaining text starts
 * @param lineEnd - The offset the line ends at, before its line break
 * @param fence - The open fence
 * @returns True when the line is a closing fence
 */
export function closesFence(text: string, at: number, lineEnd: number, fence: Fence): boolean {
  const indent = indentOf(text, at)
  if (indent.width > 3) return false
  let length = 0
  while (text[indent.end + length] === fence.char) length += 1
  return length >= fence.length && isBlank(text, indent.end + length, lineEnd)
}

/**
 * Whether a line is a thematic break: three or more of one of `*`, `-` or `_`, spaces between.
 *
 * @param text - The document
 * @param at - The first marker
 * @param lineEnd - The offset the line ends at, before its line break
 * @returns True for a break
 */
export function isThematicBreak(text: string, at: number, lineEnd: number): boolean {
  const char = text[at]
  if (char !== '*' && char !== '-' && char !== '_') return false
  let count = 0
  for (let index = at; index < lineEnd; index += 1) {
    if (text[index] === char) count += 1
    else if (!isSpace(text[index])) return false
  }
  return count >= 3
}

/**
 * The setext underline a line is: `=` for a level-one heading, `-` for level two.
 *
 * @param text - The document
 * @param at - The first underline character
 * @param lineEnd - The offset the line ends at, before its line break
 * @returns The depth, or 0 when the line is no underline
 */
export function setextDepth(text: string, at: number, lineEnd: number): number {
  const char = text[at]
  if (char !== '=' && char !== '-') return 0
  let index = at
  while (text[index] === char) index += 1
  return isBlank(text, index, lineEnd) ? (char === '=' ? 1 : 2) : 0
}

/**
 * The list marker a line opens with.
 *
 * @param text - The document
 * @param at - The marker's first character
 * @param lineEnd - The offset the line ends at, before its line break
 * @param column - The column the marker sits in
 * @returns The marker, or null
 */
export function listMarker(text: string, at: number, lineEnd: number, column: number): ListMarker | null {
  const char = text[at]
  let markerEnd = at + 1
  let ordered = false
  let start = 0
  if (char === '-' || char === '*' || char === '+') {
    if (isThematicBreak(text, at, lineEnd)) return null
  } else {
    let digits = 0
    while (digits < 9 && text[at + digits] >= '0' && text[at + digits] <= '9') digits += 1
    const delimiter = text[at + digits]
    if (digits === 0 || (delimiter !== '.' && delimiter !== ')')) return null
    ordered = true
    start = Number(text.slice(at, at + digits))
    markerEnd = at + digits + 1
  }
  if (markerEnd < lineEnd && !isSpace(text[markerEnd])) return null
  const markerWidth = markerEnd - at
  const after = indentOf(text, markerEnd, column + markerWidth)
  const empty = after.end >= lineEnd
  const spaces = empty || after.width > 4 ? 1 : after.width
  return {
    bullet: text[markerEnd - 1],
    ordered,
    start,
    markerEnd,
    contentStart: empty ? markerEnd : consumeColumns(text, markerEnd, spaces),
    contentIndent: markerWidth + spaces,
    empty,
  }
}

/**
 * The condition under which a line opens an HTML block, 1 to 7 as the specification numbers
 * them, or 0 for none.
 *
 * @param text - The document
 * @param at - The offset of the opening angle bracket
 * @param lineEnd - The offset the line ends at, before its line break
 * @param paragraphOpen - Whether a paragraph is open, which the seventh condition cannot interrupt
 * @returns The condition
 */
export function htmlStart(text: string, at: number, lineEnd: number, paragraphOpen: boolean): number {
  const line = text.slice(at, lineEnd)
  const lower = line.toLowerCase()
  if (RAW_TAGS.some((tag) => lower.startsWith(`<${tag}`) && /[\s>]|$/.test(lower.charAt(tag.length + 1)))) return 1
  if (line.startsWith('<!--')) return 2
  if (line.startsWith('<?')) return 3
  if (/^<![A-Za-z]/.test(line)) return 4
  if (line.startsWith('<![CDATA[')) return 5
  const tag = /^<\/?([A-Za-z][A-Za-z0-9-]*)(?=[\s>]|\/>|$)/.exec(line)
  if (tag !== null && BLOCK_TAGS.has(tag[1].toLowerCase())) return 6
  if (paragraphOpen) return 0
  const end = text[at + 1] === '/' ? closingTagEnd(text, at) : openTagEnd(text, at)
  return end !== -1 && end <= lineEnd && isBlank(text, end, lineEnd) ? 7 : 0
}

/**
 * Whether a line ends an HTML block opened under one of the first five conditions.
 *
 * @param line - The line as written
 * @param condition - The condition the block opened under
 * @returns True when the block ends with this line
 */
export function htmlEnds(line: string, condition: number): boolean {
  const lower = line.toLowerCase()
  switch (condition) {
    case 1:
      return RAW_TAGS.some((tag) => lower.includes(`</${tag}>`))
    case 2:
      return line.includes('-->')
    case 3:
      return line.includes('?>')
    case 4:
      return line.includes('>')
    default:
      return line.includes(']]>')
  }
}

/**
 * The cells of a table row, as spans of the line: each from its leading pipe, or the row's start,
 * to before the next pipe, the last one reaching the row's end, trailing whitespace included.
 *
 * @param text - The document
 * @param at - The row's first character
 * @param end - The offset the row ends at, trailing whitespace included
 * @returns The spans, with each cell's trimmed content
 */
export function tableCells(text: string, at: number, end: number): CellSpan[] {
  let trimmed = end
  while (trimmed > at && isSpace(text[trimmed - 1])) trimmed -= 1
  const pipes: number[] = []
  for (let index = at; index < trimmed; index += 1) {
    if (text[index] === '\\') index += 1
    else if (text[index] === '|') pipes.push(index)
  }
  const leading = pipes[0] === at
  const trailing = pipes[pipes.length - 1] === trimmed - 1
  const inner = pipes.slice(leading ? 1 : 0, trailing ? -1 : undefined)
  const starts = [at, ...inner]
  return starts.map((start, index) => {
    const cellEnd = index + 1 < starts.length ? starts[index + 1] : end
    let contentStart = start === at && !leading ? start : start + 1
    let contentEnd = cellEnd === end ? (trailing ? trimmed - 1 : trimmed) : cellEnd
    while (contentStart < contentEnd && isSpace(text[contentStart])) contentStart += 1
    while (contentEnd > contentStart && isSpace(text[contentEnd - 1])) contentEnd -= 1
    return { start, end: cellEnd, contentStart, contentEnd }
  })
}

/**
 * The alignments a delimiter row declares, or null when the line is no delimiter row.
 *
 * @param text - The document
 * @param at - The row's first character
 * @param end - The offset the row ends at, trailing whitespace included
 * @returns One alignment per column, or null
 */
export function delimiterRow(text: string, at: number, end: number): MarkdownAlign[] | null {
  const cells = tableCells(text, at, end)
  const aligns: MarkdownAlign[] = []
  for (const cell of cells) {
    const content = text.slice(cell.contentStart, cell.contentEnd)
    if (!/^:?-+:?$/.test(content)) return null
    const left = content.startsWith(':')
    const right = content.endsWith(':')
    aligns.push(left && right ? 'center' : left ? 'left' : right ? 'right' : null)
  }
  return aligns.length === 0 || (cells.length === 1 && !text.slice(at, end).includes('|')) ? null : aligns
}
