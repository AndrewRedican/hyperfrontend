/**
 * The Markdown parser: the block structure first, then the inline content of every paragraph,
 * heading and table cell, once all definitions are known.
 *
 * @module markdown/parse
 */

import type { MarkdownNode, MarkdownPoint } from './model.ts'
import { lineMap, positionAt } from '../text/lines.ts'
import { parseBlocks } from './blocks.ts'
import { parseInlines } from './inlines.ts'

/**
 * Parses a document.
 *
 * @param source - The document as read
 * @returns The root of its tree
 */
export function parseMarkdown(source: string): MarkdownNode {
  const text = source.replace(/\0/g, '\uFFFD')
  const blocks = parseBlocks(text)
  const map = lineMap(text)
  const point = (offset: number): MarkdownPoint => ({ ...positionAt(map, offset), offset })
  for (const entry of blocks.pending) {
    const references = { definitions: blocks.definitions, footnotes: blocks.footnotes, cell: entry.cell }
    entry.children.push(...parseInlines(text, entry.segments, references, point))
    if (entry.task !== null && entry.children[0]?.kind === 'text') entry.task.start = entry.children[0].position.start
  }
  return blocks.root
}
