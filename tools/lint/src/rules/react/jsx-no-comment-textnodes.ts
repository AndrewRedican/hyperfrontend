/**
 * Text inside JSX children that starts a line with `//` or `/*` reads like a comment but renders
 * as text; a comment there belongs inside braces.
 *
 * @module rules/react/jsx-no-comment-textnodes
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'

export default defineRule<undefined, Node>({
  id: 'react/jsx-no-comment-textnodes',
  language: 'code',
  fixable: false,
  create: (context) => ({
    JSXText(node) {
      const lines = context.file.text.slice(node.start, node.end).split(/\r?\n/)
      if (!lines.some(startsComment)) return
      context.report({
        start: node.start,
        end: node.end,
        message: 'Comments inside children section of tag should be placed inside braces',
      })
    },
  }),
})

/**
 * Whether a line of text, its leading whitespace aside, opens a line or block comment.
 *
 * @param line - One line of the text node's raw text
 * @returns Whether it starts with `//` or `/*`
 */
function startsComment(line: string): boolean {
  const text = line.trimStart()
  return text.startsWith('//') || text.startsWith('/*')
}
