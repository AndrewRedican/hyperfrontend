/**
 * The Markdown parser: the block structure first, then the inline content of every paragraph,
 * heading and table cell, once all definitions are known.
 *
 * @module markdown/parse
 */

import type { MarkdownNode, MarkdownPoint } from './model'
import { lineMap, positionAt } from '../text/lines'
import { parseBlocks } from './blocks'
import { parseInlines } from './inlines'

/**
 * Parses a document.
 *
 * @param source - The document as read
 * @returns The root of its tree
 *
 * @example Resolve a reference link defined later in the document
 * ```ts
 * const root = parseMarkdown('# Setup\n\nRun [the CLI][cli].\n\n[cli]: ./cli.md')
 * root.children.map((node) => node.kind)
 * // => ['heading', 'paragraph', 'definition']
 * root.children[1].children?.[1]
 * // => { kind: 'linkReference', identifier: 'cli', ... }
 * root.children[1].children?.[1].position.start
 * // => { line: 3, column: 5, offset: 13 }
 * ```
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
