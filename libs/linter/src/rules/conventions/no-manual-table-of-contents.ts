/**
 * No hand-written table of contents in Markdown: a documentation site draws one from the headings,
 * so a heading that only names an index is reported.
 *
 * @module rules/conventions/no-manual-table-of-contents
 */

import type { RuleContext } from '../../engine/rule'
import type { MarkdownNode } from '../../markdown/model'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule'

/** The headings that name an index, after normalisation. */
const INDEX_HEADINGS = createSet([
  'table of contents',
  'table of content',
  'contents',
  'toc',
  'index',
  'index of contents',
  'document index',
  'page index',
  'section index',
  'quick index',
  'full index',
  'document contents',
  'page contents',
  'section contents',
  'quick contents',
  'in this document',
  'in this page',
  'in this section',
  'in this guide',
])

/**
 * The text a heading renders, inline markup stripped.
 *
 * @param node - The heading being read, or a node beneath it
 * @returns The characters a reader sees
 */
function headingText(node: MarkdownNode): string {
  return node.value ?? (node.children ?? []).map(headingText).join('')
}

export default defineRule<undefined, MarkdownNode>({
  id: 'no-manual-table-of-contents',
  language: 'markdown',
  fixable: false,
  create(context: RuleContext<undefined, MarkdownNode>) {
    return {
      heading(node) {
        const heading = headingText(node)
        const normalised = heading
          .toLowerCase()
          .replace(/[\s:.\-–—]+$/, '')
          .replace(/\s+/g, ' ')
          .trim()
        if (!INDEX_HEADINGS.has(normalised)) return
        const { start, end } = node.position
        context.report({
          start: start.offset,
          end: end.offset,
          at: { line: start.line, column: start.column, endLine: end.line, endColumn: end.column },
          message: `Manual table-of-contents sections are not allowed in library markdown. The documentation site generates on-page navigation from the headings, so this "${heading}" section is redundant: remove the heading and the list under it rather than disabling this rule or hiding the section in the renderer.`,
        })
      },
    }
  },
})
