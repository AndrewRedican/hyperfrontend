/**
 * Markdown as a language: the tree the parser builds, with the HTML comments the directives are
 * read from.
 *
 * @module languages/markdown
 */

import type { SourceComment } from '../config/directives.ts'
import type { LanguageAdapter, ParsedFile } from '../engine/languages.ts'
import type { MarkdownNode } from '../markdown/model.ts'
import { parseMarkdown } from '../markdown/parse.ts'

/** An HTML comment, wherever it sits in an HTML node. */
const COMMENT = /<!--([\s\S]*?)-->/g

/**
 * The comments of a tree, in source order.
 *
 * @param node - The node to look under
 * @param found - Where the comments go
 */
function collectComments(node: MarkdownNode, found: SourceComment[]): void {
  if (node.kind === 'html' && node.value !== undefined) {
    for (const match of node.value.matchAll(COMMENT)) {
      const start = node.position.start.offset + match.index
      found.push({ start, end: start + match[0].length, text: match[1] })
    }
  }
  for (const child of node.children ?? []) collectComments(child, found)
}

/**
 * Parses a Markdown text; Markdown never fails to parse.
 *
 * @param text - The document
 * @returns The tree and its comments
 */
function parse(text: string): ParsedFile<MarkdownNode> {
  const tree = parseMarkdown(text)
  const comments: SourceComment[] = []
  collectComments(tree, comments)
  return { tree, comments, error: null }
}

/**
 * The children of a node.
 *
 * @param node - Any node
 * @returns Its children, none for a leaf
 */
function children(node: MarkdownNode): readonly MarkdownNode[] {
  return node.children ?? []
}

/** Markdown as the engine reads it. */
export const markdownLanguage: LanguageAdapter<MarkdownNode> = { name: 'markdown', parse, children }
