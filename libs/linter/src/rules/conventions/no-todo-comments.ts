/**
 * No comment carries a marker of work left for later, in any of its spellings: that work belongs
 * in a tracking ticket, not in the code.
 *
 * @module rules/conventions/no-todo-comments
 */

import type { Node } from '../../code/model'
import { defineRule } from '../../engine/rule'

/** The marker, spelled as one word, hyphenated or spaced, standing alone between word characters and hyphens. */
// lint-disable-next-line no-unsafe-regex -- one optional character between fixed letters, no nested quantifier
const MARKER = /(?<![\w-])to[- ]?do(?![\w-])/gi

/** What the rule reports for a work-left-for-later marker. */
const MESSAGE = 'TODO comments are not allowed. Address the issue or create a tracking ticket instead of leaving TODO markers in the code.'

export default defineRule<undefined, Node>({
  id: 'no-todo-comments',
  language: 'code',
  fixable: false,
  create(context) {
    return {
      Program() {
        for (const comment of context.file.comments) {
          const base = comment.start + 2
          for (const match of comment.text.matchAll(MARKER)) {
            const start = base + match.index
            context.report({ start, end: start + match[0].length, message: MESSAGE })
          }
        }
      },
    }
  },
})
