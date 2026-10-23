/**
 * Every fenced code block in documentation names its language, so the block is highlighted,
 * announced and tooled as what it is.
 *
 * @module rules/conventions/require-codeblock-language
 */

import type { RuleContext } from '../../engine/rule'
import type { MarkdownNode } from '../../markdown/model'
import { defineRule } from '../../engine/rule'

const MESSAGE =
  'Code block is missing a language identifier. Add a language (e.g., ```typescript, ```json, ```bash) after the opening backticks.'

export default defineRule<undefined, MarkdownNode>({
  id: 'require-codeblock-language',
  language: 'markdown',
  fixable: false,
  create(context: RuleContext<undefined, MarkdownNode>) {
    return {
      root() {
        let inside = false
        let offset = 0
        context.file.text.split(/\r?\n/).forEach((line, index) => {
          if (line.trimStart().startsWith('```')) {
            if (!inside) {
              inside = true
              const column = line.indexOf('```')
              if (line.slice(column + 3).trim() === '') {
                context.report({
                  start: offset + column,
                  message: MESSAGE,
                  at: { line: index + 1, column, endLine: index + 1, endColumn: column + 3 },
                })
              }
            } else inside = false
          }
          offset += line.length + 1
        })
      },
    }
  },
})
