/**
 * An interface member is documented by a JSDoc block above it, not by a line comment trailing
 * it: the comment is moved into a block above the member when the member has none yet.
 *
 * @module rules/conventions/prefer-jsdoc-over-trailing-comments
 */

import type { Node } from '../../code/model'
import { defineRule } from '../../engine/rule'
import { positionAt } from '../../text/lines'
import { isJsdocComment, isLineComment } from './shared/comments'

/** What the rule reports for a trailing comment on a member. */
const MESSAGE =
  'Use a JSDoc comment above the member instead of a trailing inline comment. This allows documentation tools to collect the information correctly.'

export default defineRule<undefined, Node>({
  id: 'prefer-jsdoc-over-trailing-comments',
  language: 'code',
  fixable: true,
  create(context) {
    const { file } = context
    return {
      TSInterfaceBody(node) {
        for (const member of node.body as readonly Node[]) {
          const line = positionAt(file.lines, member.end).line
          const trailing = file.comments.find(
            (comment) =>
              comment.start >= member.end &&
              positionAt(file.lines, comment.start).line === line &&
              file.text.slice(member.end, comment.start).trim() === ''
          )
          if (trailing === undefined || !isLineComment(file, trailing)) continue
          const documented = file.comments.some(
            (comment) =>
              isJsdocComment(file, comment) && comment.end <= member.start && file.text.slice(comment.end, member.start).trim() === ''
          )
          const lineStart = file.lines.starts[positionAt(file.lines, member.start).line - 1] as number
          const indent = file.text.slice(lineStart, member.start)
          const moved = `${indent}/** ${trailing.text.trim()} */\n${indent}${file.text.slice(member.start, trailing.start).trimEnd()}`
          context.report({
            start: trailing.start,
            end: trailing.end,
            message: MESSAGE,
            ...(documented ? {} : { fix: { start: lineStart, end: trailing.end, text: moved } }),
          })
        }
      },
    }
  },
})
