/**
 * The pieces the inline tokeniser produces before emphasis and brackets are resolved: text runs,
 * finished spans, delimiter runs and bracket openers, each over content indices that map back to
 * the source.
 *
 * @module markdown/items
 */

import type { Segment } from './blocks.ts'

/** The kinds of piece. */
export type ItemKind =
  | 'text'
  | 'inlineCode'
  | 'html'
  | 'break'
  | 'link'
  | 'image'
  | 'linkReference'
  | 'imageReference'
  | 'footnoteReference'
  | 'emphasis'
  | 'strong'
  | 'delete'
  | 'delimiter'
  | 'bracket'

/** One piece of inline content. */
export interface Item {
  /** Which piece. */
  kind: ItemKind
  /** The content index of its first character. */
  start: number
  /** The content index after its last character. */
  end: number
  /** The decoded text, code or raw HTML. */
  value: string
  /** The pieces inside a link, image or emphasis. */
  children: Item[]
  /** The target of a link or image. */
  url: string
  /** The title of a link or image, or null. */
  title: string | null
  /** The identifier of a reference. */
  identifier: string
  /** The character of a delimiter run. */
  char: string
  /** How many of it remain unconsumed. */
  count: number
  /** How many of it the run had. */
  originalCount: number
  /** Whether the run can open emphasis. */
  canOpen: boolean
  /** Whether the run can close emphasis. */
  canClose: boolean
  /** Whether a bracket opener is an image's. */
  image: boolean
  /** Whether a bracket opener may still form a link. */
  active: boolean
}

/** The content of a block as one string, with each index's source offset. */
export interface Content {
  /** The lines joined with line feeds. */
  readonly text: string
  /** The source offset of a content index; as an end, a line boundary maps to just after the line ending. */
  readonly sourceAt: (index: number, end?: boolean) => number
}

/**
 * A piece with nothing in it.
 *
 * @param kind - Which piece
 * @param start - Its first content index
 * @param end - The index after its last
 * @returns The piece
 */
export function item(kind: ItemKind, start: number, end: number): Item {
  return {
    kind,
    start,
    end,
    value: '',
    children: [],
    url: '',
    title: null,
    identifier: '',
    char: '',
    count: 0,
    originalCount: 0,
    canOpen: false,
    canClose: false,
    image: false,
    active: true,
  }
}

/**
 * Joins a block's lines into one content string.
 *
 * @param text - The document
 * @param segments - The lines, as source spans
 * @returns The content and its mapping back to the source
 */
export function contentOf(text: string, segments: readonly Segment[]): Content {
  const starts: number[] = []
  let joined = ''
  segments.forEach((segment, index) => {
    starts.push(joined.length)
    joined += text.slice(segment.start, segment.end)
    if (index < segments.length - 1) joined += text[segment.end] === '\r' ? '\r\n' : '\n'
  })
  const sourceAt = (index: number, end = false): number => {
    let at = starts.length - 1
    while (at > 0 && starts[at] > index) at -= 1
    if (end && at > 0 && starts[at] === index) {
      const previous = segments[at - 1].end
      return previous + (text[previous] === '\r' ? 2 : 1)
    }
    const segment = segments[at]
    return segment.start + index - starts[at] > segment.end ? segment.end : segment.start + index - starts[at]
  }
  return { text: joined, sourceAt }
}
