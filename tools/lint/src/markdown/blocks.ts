/**
 * The block structure of a document, built one line at a time: the open containers (block
 * quotes, list items, footnote definitions) are matched against each line's prefix, the leaf
 * inside them continues or closes, and whatever remains opens new blocks. Paragraph, heading
 * and table-cell content comes back as source spans for the inline parser; every other block
 * is a finished node.
 *
 * @module markdown/blocks
 */

import type { Definition } from './definitions.ts'
import type { MarkdownAlign, MarkdownNode, MarkdownPoint, MarkdownPosition } from './model.ts'
import type { Fence, HeadingStart, ListMarker } from './starts.ts'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { lineMap, positionAt } from '../text/lines.ts'
import { normaliseLabel, takeDefinitions } from './definitions.ts'
import {
  atxHeading,
  closesFence,
  consumeColumns,
  delimiterRow,
  htmlEnds,
  htmlStart,
  indentOf,
  isBlank,
  isThematicBreak,
  listMarker,
  openingFence,
  setextDepth,
  tableCells,
} from './starts.ts'

/** A span of the source that is a block's content. */
export interface Segment {
  /** The first character. */
  readonly start: number
  /** The offset after the last character. */
  readonly end: number
}

/** A position whose start may still move. */
export interface MovablePosition {
  /** The first character. */
  start: MarkdownPoint
  /** After the last character. */
  readonly end: MarkdownPoint
}

/** Inline content a node waits for. */
export interface PendingInline {
  /** The array the inline nodes go into. */
  readonly children: MarkdownNode[]
  /** The content, one span per line. */
  readonly segments: readonly Segment[]
  /** Whether the content is a table cell. */
  readonly cell: boolean
  /** The paragraph position a task list item's checkbox was taken from, which moves to the text that follows it. */
  readonly task: MovablePosition | null
}

/** What the block parser produced. */
export interface ParsedBlocks {
  /** The root, its paragraph, heading and cell children still empty. */
  readonly root: MarkdownNode
  /** The content still to parse, in document order. */
  readonly pending: readonly PendingInline[]
  /** The link definitions by identifier. */
  readonly definitions: ReadonlyMap<string, Definition>
  /** The identifiers of the footnote definitions. */
  readonly footnotes: ReadonlySet<string>
}

/** A footnote definition's opening. */
interface FootnoteStart {
  /** The normalised label. */
  readonly identifier: string
  /** The offset where the content begins on the opening line. */
  readonly contentStart: number
}

/** The kinds of open block. */
type OpenKind =
  | 'document'
  | 'blockquote'
  | 'list'
  | 'listItem'
  | 'footnoteDefinition'
  | 'paragraph'
  | 'code'
  | 'indented'
  | 'html'
  | 'table'

/** A block still open. */
interface Open {
  /** Which block it is. */
  readonly kind: OpenKind
  /** The offset of its first character. */
  readonly start: number
  /** The offset after the last character seen so far. */
  end: number
  /** The finished children. */
  readonly children: MarkdownNode[]
  /** The content lines of a leaf, or the rows of a table. */
  readonly lines: Segment[]
  /** The columns a continuation line of a list item or footnote must be indented by. */
  contentIndent: number
  /** The marker of a list, or of the item. */
  marker: ListMarker | null
  /** The fence of a fenced code block. */
  fence: Fence | null
  /** The condition an HTML block opened under. */
  htmlCondition: number
  /** The identifier of a footnote definition. */
  identifier: string
  /** The alignments of a table. */
  align: readonly MarkdownAlign[]
  /** The checkbox state of a task list item. */
  checked: boolean | undefined
  /** Whether a list item opened with nothing after its marker. */
  emptyStart: boolean
  /** Whether a list item has had content on a later line. */
  started: boolean
  /** The offset of a task list item's checkbox, until its paragraph opens. */
  checkbox: number
}

/** The kinds that hold content rather than blocks. */
const LEAVES: readonly OpenKind[] = ['paragraph', 'code', 'indented', 'html', 'table']

/**
 * A block with nothing in it yet.
 *
 * @param kind - Which block
 * @param start - Its first character
 * @returns The open block
 */
function open(kind: OpenKind, start: number): Open {
  return {
    kind,
    start,
    end: start,
    children: [],
    lines: [],
    contentIndent: 0,
    marker: null,
    fence: null,
    htmlCondition: 0,
    identifier: '',
    align: [],
    checked: undefined,
    emptyStart: false,
    started: false,
    checkbox: -1,
  }
}

/**
 * Parses the block structure of a document.
 *
 * @param text - The document
 * @returns The tree with its inline content pending, the definitions and the footnotes
 */
export function parseBlocks(text: string): ParsedBlocks {
  const map = lineMap(text)
  const point = (offset: number): MarkdownPoint => ({ ...positionAt(map, offset), offset })
  const span = (start: number, end: number): MarkdownPosition => ({ start: point(start), end: point(end) })
  const pending: PendingInline[] = []
  const definitions = createMap<string, Definition>()
  const footnotes = createSet<string>()
  const stack: Open[] = [open('document', 0)]
  const top = (): Open => stack[stack.length - 1]
  let matched = 1

  const addChild = (parent: Open, node: MarkdownNode): void => {
    parent.children.push(node)
    if (node.position.end.offset > parent.end) parent.end = node.position.end.offset
  }

  const inlineNode = (
    kind: 'paragraph' | 'heading' | 'tableCell',
    position: MovablePosition,
    segments: Segment[],
    depth?: number,
    task = false
  ): MarkdownNode => {
    const children: MarkdownNode[] = []
    pending.push({ children, segments, cell: kind === 'tableCell', task: task ? position : null })
    return depth === undefined ? { kind, position, children } : { kind, position, children, depth }
  }

  const finish = (block: Open, parent: Open): void => {
    switch (block.kind) {
      case 'paragraph': {
        const taken = takeDefinitions(text, block.lines)
        for (const definition of taken.definitions) {
          if (!definitions.has(definition.identifier)) definitions.set(definition.identifier, definition)
          const node: MarkdownNode = {
            kind: 'definition',
            position: span(definition.start, definition.end),
            url: definition.url,
            identifier: definition.identifier,
          }
          addChild(parent, definition.title === null ? node : { ...node, title: definition.title })
        }
        if (taken.rest.length > 0) {
          const start = block.checkbox === -1 ? taken.rest[0].start : block.checkbox
          addChild(
            parent,
            inlineNode('paragraph', span(start, taken.rest[taken.rest.length - 1].end), [...taken.rest], undefined, block.checkbox !== -1)
          )
        }
        return
      }
      case 'code': {
        const fence = block.fence as Fence
        const value = block.lines.map((line) => text.slice(line.start, line.end)).join('\n')
        const node: MarkdownNode = { kind: 'code', position: span(block.start, block.end), value }
        addChild(parent, {
          ...node,
          ...(fence.lang === '' ? {} : { lang: fence.lang }),
          ...(fence.meta === '' ? {} : { meta: fence.meta }),
        })
        return
      }
      case 'indented': {
        const lines = [...block.lines]
        while (lines.length > 0 && isBlank(text, lines[lines.length - 1].start, lines[lines.length - 1].end)) lines.pop()
        const value = lines.map((line) => text.slice(line.start, line.end)).join('\n')
        addChild(parent, { kind: 'code', position: span(block.start, lines[lines.length - 1].end), value })
        return
      }
      case 'html':
        addChild(parent, {
          kind: 'html',
          position: span(block.start, block.end),
          value: block.lines.map((line) => text.slice(line.start, line.end)).join('\n'),
        })
        return
      case 'table':
        addChild(parent, { kind: 'table', position: span(block.start, block.end), align: block.align, children: block.children })
        return
      case 'list':
        addChild(parent, {
          kind: 'list',
          position: span(block.start, block.end),
          ordered: (block.marker as ListMarker).ordered,
          ...((block.marker as ListMarker).ordered ? { start: (block.marker as ListMarker).start } : {}),
          children: block.children,
        })
        return
      case 'listItem':
        addChild(parent, {
          kind: 'listItem',
          position: span(block.start, block.end),
          ...(block.checked === undefined ? {} : { checked: block.checked }),
          children: block.children,
        })
        return
      case 'footnoteDefinition':
        addChild(parent, {
          kind: 'footnoteDefinition',
          position: span(block.start, block.end),
          identifier: block.identifier,
          children: block.children,
        })
        return
      default:
        addChild(parent, { kind: 'blockquote', position: span(block.start, block.end), children: block.children })
    }
  }

  const closeTop = (): void => {
    const block = stack.pop() as Open
    finish(block, top())
  }
  const closeTo = (length: number): void => {
    while (stack.length > length) closeTop()
  }
  const closeUnmatched = (): void => {
    closeTo(matched)
    if (top().kind === 'list') closeTop()
  }
  const push = (block: Open): Open => {
    stack.push(block)
    return block
  }

  const addRow = (table: Open, at: number, lineEnd: number): void => {
    const rowStart = indentOf(text, at).end
    const cells = tableCells(text, rowStart, lineEnd).map((cell) =>
      inlineNode(
        'tableCell',
        span(cell.start, cell.end),
        cell.contentStart < cell.contentEnd ? [{ start: cell.contentStart, end: cell.contentEnd }] : []
      )
    )
    table.children.push({ kind: 'tableRow', position: span(rowStart, lineEnd), children: cells })
    table.end = lineEnd
  }

  const startTable = (paragraph: Open, align: readonly MarkdownAlign[], delimiterEnd: number): boolean => {
    const header = paragraph.lines[paragraph.lines.length - 1]
    if (tableCells(text, header.start, header.end).length !== align.length) return false
    paragraph.lines.pop()
    stack.pop()
    if (paragraph.lines.length > 0) {
      paragraph.end = paragraph.lines[paragraph.lines.length - 1].end
      finish(paragraph, top())
    }
    const table = push(open('table', header.start))
    table.align = align
    addRow(table, header.start, header.end)
    table.end = delimiterEnd
    return true
  }

  const processLine = (lineStart: number, lineEnd: number): void => {
    let at = lineStart
    matched = 1
    for (let depth = 1; depth < stack.length; depth += 1) {
      const block = stack[depth]
      if (block.kind === 'blockquote') {
        const indent = indentOf(text, at)
        if (indent.width > 3 || text[indent.end] !== '>') break
        at = indent.end + 1
        if (text[at] === ' ' || text[at] === '\t') at += 1
      } else if (block.kind === 'listItem' || block.kind === 'footnoteDefinition') {
        if (isBlank(text, at, lineEnd)) {
          if (block.emptyStart && !block.started) break
        } else {
          if (indentOf(text, at).width < block.contentIndent) break
          at = consumeColumns(text, at, block.contentIndent)
          block.started = true
        }
      } else if (block.kind !== 'list') break
      matched = depth + 1
    }
    if (!isBlank(text, lineStart, lineEnd)) {
      for (let depth = 1; depth < matched; depth += 1) {
        const block = stack[depth]
        if (block.kind === 'blockquote' || (block.kind === 'list' && depth + 1 < matched)) block.end = lineEnd
      }
    }
    const leaf = top()
    if (LEAVES.includes(leaf.kind) && matched === stack.length - 1) {
      if (leaf.kind === 'code') {
        if (closesFence(text, at, lineEnd, leaf.fence as Fence)) {
          leaf.end = lineEnd
          closeTop()
        } else {
          leaf.lines.push({ start: consumeColumns(text, at, (leaf.fence as Fence).indent), end: lineEnd })
          leaf.end = lineEnd
        }
        return
      }
      if (leaf.kind === 'indented') {
        if (isBlank(text, at, lineEnd) || indentOf(text, at).width >= 4) {
          leaf.lines.push({ start: consumeColumns(text, at, 4), end: lineEnd })
          return
        }
        closeTop()
      } else if (leaf.kind === 'html') {
        if (leaf.htmlCondition >= 6 && isBlank(text, at, lineEnd)) closeTop()
        else {
          leaf.lines.push({ start: at, end: lineEnd })
          leaf.end = lineEnd
          if (leaf.htmlCondition <= 5 && htmlEnds(text.slice(at, lineEnd), leaf.htmlCondition)) closeTop()
          return
        }
      } else if (leaf.kind === 'table') {
        if (!isBlank(text, at, lineEnd) && !startsBlock(at, lineEnd)) {
          addRow(leaf, at, lineEnd)
          return
        }
        closeTop()
      }
    }
    let startedContainer = false
    for (;;) {
      const indent = indentOf(text, at)
      const first = indent.end
      if (first >= lineEnd) break
      const paragraphOpen = top().kind === 'paragraph' && matched === stack.length - 1
      if (indent.width >= 4) {
        if (top().kind !== 'paragraph') {
          closeUnmatched()
          const code = push(open('indented', at))
          code.lines.push({ start: consumeColumns(text, at, 4), end: lineEnd })
          code.end = lineEnd
          return
        }
        break
      }
      const char = text[first]
      if (char === '>') {
        closeUnmatched()
        push(open('blockquote', first)).end = first + 1
        at = first + 1
        if (text[at] === ' ' || text[at] === '\t') at += 1
        matched = stack.length
        startedContainer = true
        continue
      }
      const heading = char === '#' ? atxHeading(text, first, lineEnd) : null
      if (heading !== null) {
        closeUnmatched()
        addHeading(first, lineEnd, heading)
        return
      }
      const fence = openingFence(text, first, lineEnd, indent.width)
      if (fence !== null) {
        closeUnmatched()
        push(open('code', first)).fence = fence
        top().end = lineEnd
        return
      }
      const html = char === '<' ? htmlStart(text, first, lineEnd, paragraphOpen) : 0
      if (html !== 0) {
        closeUnmatched()
        const block = push(open('html', at))
        block.htmlCondition = html
        block.lines.push({ start: at, end: lineEnd })
        block.end = lineEnd
        if (html <= 5 && htmlEnds(text.slice(at, lineEnd), html)) closeTop()
        return
      }
      const setext = paragraphOpen ? setextDepth(text, first, lineEnd) : 0
      if (setext !== 0) {
        const paragraph = stack.pop() as Open
        addChild(top(), inlineNode('heading', span(paragraph.lines[0].start, lineEnd), paragraph.lines, setext))
        return
      }
      if (isThematicBreak(text, first, lineEnd)) {
        closeUnmatched()
        addChild(top(), { kind: 'thematicBreak', position: span(first, lineEnd) })
        return
      }
      const marker = listMarker(text, first, lineEnd, indent.width)
      if (marker !== null && !(paragraphOpen && (marker.empty || (marker.ordered && marker.start !== 1)))) {
        closeTo(matched)
        const current = top()
        if (current.kind === 'list' && (current.marker?.bullet !== marker.bullet || current.marker.ordered !== marker.ordered)) closeTop()
        if (top().kind !== 'list') push(open('list', first)).marker = marker
        const item = push(open('listItem', first))
        item.marker = marker
        item.contentIndent = indent.width + marker.contentIndent
        item.emptyStart = marker.empty
        item.end = marker.markerEnd
        at = marker.contentStart
        if (!marker.empty && /^\[[ xX]\][ \t]/.test(text.slice(at, at + 4))) {
          item.checked = text[at + 1] !== ' '
          item.checkbox = at
          at += 4
        }
        matched = stack.length
        startedContainer = true
        continue
      }
      const footnote = char === '[' && text[first + 1] === '^' ? footnoteStart(first, lineEnd) : null
      if (footnote !== null) {
        closeUnmatched()
        const block = push(open('footnoteDefinition', first))
        block.identifier = footnote.identifier
        block.contentIndent = 4
        block.end = footnote.contentStart
        footnotes.add(footnote.identifier)
        at = footnote.contentStart
        matched = stack.length
        startedContainer = true
        continue
      }
      break
    }
    if (isBlank(text, at, lineEnd)) {
      if (top().kind === 'paragraph') closeTop()
      closeTo(matched)
      return
    }
    const contentStart = indentOf(text, at).end
    const current = top()
    if (current.kind === 'paragraph' && !startedContainer) {
      if (matched === stack.length - 1) {
        const align = delimiterRow(text, contentStart, lineEnd)
        if (align !== null && startTable(current, align, lineEnd)) return
      }
      current.lines.push({ start: contentStart, end: lineEnd })
      current.end = lineEnd
      return
    }
    const checkbox = current.kind === 'listItem' && startedContainer ? current.checkbox : -1
    closeUnmatched()
    const paragraph = push(open('paragraph', contentStart))
    paragraph.lines.push({ start: contentStart, end: lineEnd })
    paragraph.end = lineEnd
    paragraph.checkbox = checkbox
  }

  const addHeading = (first: number, lineEnd: number, heading: HeadingStart): void => {
    const segments = heading.contentStart < heading.contentEnd ? [{ start: heading.contentStart, end: heading.contentEnd }] : []
    addChild(top(), inlineNode('heading', span(first, lineEnd), segments, heading.depth))
  }

  const footnoteStart = (first: number, lineEnd: number): FootnoteStart | null => {
    let index = first + 2
    while (index < lineEnd && text[index] !== ']' && !/\s/.test(text[index])) index += 1
    if (index === first + 2 || text[index] !== ']' || text[index + 1] !== ':') return null
    let contentStart = index + 2
    while (contentStart < lineEnd && (text[contentStart] === ' ' || text[contentStart] === '\t')) contentStart += 1
    return { identifier: normaliseLabel(text.slice(first + 2, index)), contentStart }
  }

  const startsBlock = (at: number, lineEnd: number): boolean => {
    const indent = indentOf(text, at)
    const first = indent.end
    if (indent.width >= 4) return true
    const char = text[first]
    return (
      char === '>' ||
      (char === '#' && atxHeading(text, first, lineEnd) !== null) ||
      openingFence(text, first, lineEnd, indent.width) !== null ||
      (char === '<' && htmlStart(text, first, lineEnd, true) !== 0) ||
      isThematicBreak(text, first, lineEnd) ||
      listMarker(text, first, lineEnd, indent.width) !== null ||
      (char === '[' && text[first + 1] === '^' && footnoteStart(first, lineEnd) !== null)
    )
  }

  for (let index = 0; index < map.starts.length; index += 1) {
    const lineStart = map.starts[index]
    let lineEnd = index + 1 < map.starts.length ? map.starts[index + 1] - 1 : text.length
    if (lineEnd > lineStart && text[lineEnd - 1] === '\r') lineEnd -= 1
    processLine(lineStart, lineEnd)
  }
  closeTo(1)
  return { root: { kind: 'root', position: span(0, text.length), children: stack[0].children }, pending, definitions, footnotes }
}
