/**
 * A README paragraph stays within what a reader commits to at once: rendered characters, link
 * text without its target, images and inline HTML without width, measured on body prose only.
 *
 * @module rules/conventions/readme-paragraph-length
 */

import type { RuleContext } from '../../engine/rule'
import type { MarkdownNode } from '../../markdown/model'
import { defineRule } from '../../engine/rule'

/** The rule's options. */
interface Options {
  /** Rendered characters a paragraph may reach before it is reported. */
  readonly maxCharacters?: number
}

/** The default limit. */
const DEFAULT_MAX_CHARACTERS = 700

/** The containers whose paragraphs are fragments governed by the structure around them. */
const SKIPPED_CONTAINERS = ['listItem', 'blockquote', 'tableCell', 'footnoteDefinition']

/** The nodes that render no width. */
const WIDTHLESS = ['image', 'imageReference', 'html', 'break']

/**
 * The prose a node renders.
 *
 * @param node - A paragraph, or a node under it
 * @returns The characters a reader sees
 */
function renderProse(node: MarkdownNode): string {
  if (WIDTHLESS.includes(node.kind)) return ''
  if (node.kind === 'text' || node.kind === 'inlineCode') return node.value ?? ''
  return (node.children ?? []).map(renderProse).join('')
}

export default defineRule<Options | undefined, MarkdownNode>({
  id: 'readme-paragraph-length',
  language: 'markdown',
  fixable: false,
  create(context: RuleContext<Options | undefined, MarkdownNode>) {
    const maximum = context.options?.maxCharacters ?? DEFAULT_MAX_CHARACTERS
    return {
      paragraph(node, parents) {
        if (parents.some((parent) => SKIPPED_CONTAINERS.includes(parent.kind))) return
        const characters = renderProse(node).replace(/\s+/g, ' ').trim().length
        if (characters <= maximum) return
        const { start, end } = node.position
        context.report({
          start: start.offset,
          end: end.offset,
          at: { line: start.line, column: start.column - 1, endLine: end.line, endColumn: end.column - 1 },
          message: `This paragraph is ${characters} characters, past the ${maximum} this file allows. Consider splitting it into focused ideas, or making it more concise. Prefer clearer prose over an arbitrary break.`,
        })
      },
    }
  },
})
