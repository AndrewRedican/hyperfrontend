/**
 * Every fenced code block in documentation names its language, so the block is highlighted,
 * announced and tooled as what it is. Applies to Markdown at the workspace root and in a
 * publishable library's own directory.
 *
 * @module rules/workspace/require-codeblock-language
 */

import type { RuleContext } from '../../engine/rule.ts'
import type { MarkdownNode } from '../../markdown/model.ts'
import { dirname } from 'node:path'
import { defineRule } from '../../engine/rule.ts'
import { isAtWorkspaceRoot } from './shared/locate.ts'
import { isPublishableLibrary } from './shared/project-file.ts'

const MESSAGE =
  'Code block is missing a language identifier. Add a language (e.g., ```typescript, ```json, ```bash) after the opening backticks.'

export default defineRule<undefined, MarkdownNode>({
  id: 'workspace/require-codeblock-language',
  language: 'markdown',
  fixable: false,
  create(context: RuleContext<undefined, MarkdownNode>) {
    const path = context.file.path
    if (!(isAtWorkspaceRoot(path) || isPublishableLibrary(dirname(path)))) return {}
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
