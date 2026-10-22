/**
 * No block comment carries a `@deprecated` tag: breaking changes ship in a major version, and the
 * code they replace is removed rather than kept beside a warning. The first tag of a block is
 * reported, a tag being the word in any case followed by whitespace, `*` or the end of the block,
 * so a mention such as `` `@deprecated` `` in prose passes.
 *
 * @module rules/workspace/no-deprecated-tag
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'

/** The tag, in any case, followed by whitespace, `*` or the end of the block. */
const TAG = /@deprecated(?=[ \t\r\n*]|$)/i

/** What the rule reports, pointing at semantic versioning. */
const MESSAGE =
  'The deprecated tag is not allowed. This project handles breaking changes through semantic versioning and does not support backwards compatibility. Remove deprecated code in the next major version instead.'

export default defineRule<undefined, Node>({
  id: 'workspace/no-deprecated-tag',
  language: 'code',
  fixable: false,
  create(context) {
    return {
      Program() {
        for (const comment of context.file.comments) {
          if (!context.file.text.startsWith('/*', comment.start)) continue
          const match = TAG.exec(comment.text)
          if (match === null) continue
          const start = comment.start + 2 + match.index
          context.report({ start, end: start + match[0].length, message: MESSAGE })
        }
      },
    }
  },
})
