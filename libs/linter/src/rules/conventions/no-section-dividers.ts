/**
 * No line comment draws a section divider of four or more `=`: a run of comments from one
 * divider to the next is removed whole, together with the line break that ends it.
 *
 * @module rules/conventions/no-section-dividers
 */

import type { Node } from '../../code/model'
import type { SourceComment } from '../../config/directives'
import { defineRule } from '../../engine/rule'
import { positionAt } from '../../text/lines'
import { isLineComment } from './shared/comments'

/** What the rule reports for a divider comment. */
const MESSAGE =
  'Section divider comments are not allowed. Use meaningful code organization (separate files, classes, or functions) instead of visual separators.'

export default defineRule<undefined, Node>({
  id: 'no-section-dividers',
  language: 'code',
  fixable: true,
  create(context) {
    const { file } = context
    const isDivider = (comment: SourceComment): boolean => isLineComment(file, comment) && comment.text.includes('====')
    return {
      Program() {
        const comments = file.comments
        for (let index = 0; index < comments.length; index += 1) {
          const first = comments[index] as SourceComment
          if (!isDivider(first)) continue
          let last = index
          for (let next = index + 1; next < comments.length; next += 1) {
            const comment = comments[next] as SourceComment
            const previous = comments[next - 1] as SourceComment
            if (
              !isLineComment(file, comment) ||
              positionAt(file.lines, comment.start).line !== positionAt(file.lines, previous.start).line + 1
            )
              break
            if (isDivider(comment)) {
              last = next
              break
            }
          }
          const closing = comments[last] as SourceComment
          const lineStart = file.text.lastIndexOf('\n', first.start - 1) + 1
          const ownLine = file.text.slice(lineStart, first.start).trim() === ''
          // why: a divider behind code keeps its line break, or the fix would join that code to the next line.
          const end = !ownLine
            ? closing.end
            : file.text.startsWith('\r\n', closing.end)
              ? closing.end + 2
              : file.text[closing.end] === '\n'
                ? closing.end + 1
                : closing.end
          const fixStart = ownLine ? first.start : lineStart + file.text.slice(lineStart, first.start).trimEnd().length
          context.report({ start: first.start, end, message: MESSAGE, fix: { start: fixStart, end, text: '' } })
          index = last
        }
      },
    }
  },
})
