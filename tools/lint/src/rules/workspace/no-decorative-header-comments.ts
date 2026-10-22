/**
 * A file does not open with a decorative block comment: a multi-line comment of prose alone,
 * carrying no tag, set apart from the code by a blank line or followed by code that is not a
 * declaration it could document, is removed together with the whitespace after it.
 *
 * @module rules/workspace/no-decorative-header-comments
 */

import type { Node } from '../../code/model.ts'
import type { SourceComment } from '../../config/directives.ts'
import { defineRule } from '../../engine/rule.ts'
import { isLineComment } from './shared/comments.ts'

/** What the rule reports for a decorative header. */
const MESSAGE =
  'Decorative file header comments are not allowed. Either add meaningful JSDoc tags (@module, @param, etc.) or remove the comment.'

/** The words a declaration the comment could document starts with. */
const DECLARATIONS = /^(export|import|interface|type|class|function|const|let|var|async|abstract|enum|namespace|module|declare) /

/**
 * Whether a comment opening a file is decorative.
 *
 * @param text - The file's text
 * @param comment - The first comment
 * @returns Whether it is prose alone, unattached to a declaration
 */
function isDecorative(text: string, comment: SourceComment): boolean {
  const lines = comment.text.split(/\r?\n/)
  if (lines.length < 2 || lines.some((line) => line.trim().replace(/^\*+/, '').trim().startsWith('@'))) return false
  const after = text.slice(comment.end)
  const content = after.trimStart()
  const gap = after.slice(0, after.length - content.length)
  return content === '' || gap.split(/\r?\n/).length > 2 || !DECLARATIONS.test(content)
}

export default defineRule<undefined, Node>({
  id: 'workspace/no-decorative-header-comments',
  language: 'code',
  fixable: true,
  create(context) {
    const { file } = context
    return {
      Program() {
        const first = file.comments[0]
        if (
          first === undefined ||
          isLineComment(file, first) ||
          file.text.slice(0, first.start).trim() !== '' ||
          !isDecorative(file.text, first)
        )
          return
        const end = file.text.length - file.text.slice(first.end).trimStart().length
        context.report({ start: first.start, end: first.end, message: MESSAGE, fix: { start: first.start, end, text: '' } })
      },
    }
  },
})
