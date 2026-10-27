/**
 * The root compatibility document is generated from every package's `project.json` and
 * `package.json`; when it no longer matches them, the fix rewrites it.
 *
 * @module rules/workspace/lib-compatibility-matrix
 */

import type { MarkdownNode, RuleContext } from '@hyperfrontend/linter'
import { basename, dirname } from 'node:path'
import { defineRule } from '@hyperfrontend/linter'
import { buildCompatibilityDocument, COMPATIBILITY_DOCUMENT_NAME } from '@hyperfrontend/workspace'
import { workspaceRootOf } from './shared/locate.ts'

const MESSAGE =
  'LIBRARY_COMPATIBILITY.md is generated from each package project.json and package.json, and no longer matches them. Run `npm run hf -- run @hyperfrontend/workspace:lint:all` (or `npm run hf -- run @hyperfrontend/workspace:lint --fix`) to regenerate it.'

export default defineRule<undefined, MarkdownNode>({
  id: 'workspace/lib-compatibility-matrix',
  language: 'markdown',
  fixable: true,
  create(context: RuleContext<undefined, MarkdownNode>) {
    const path = context.file.path
    const directory = dirname(path)
    if (basename(path) !== COMPATIBILITY_DOCUMENT_NAME || workspaceRootOf(directory) !== directory) return {}
    return {
      root(node) {
        const expected = buildCompatibilityDocument(directory)
        const content = context.file.text
        if (content === expected) return
        const { start, end } = node.position
        context.report({
          start: start.offset,
          end: end.offset,
          at: { line: start.line, column: start.column, endLine: end.line, endColumn: end.column },
          message: MESSAGE,
          fix: { start: 0, end: content.length, text: expected },
        })
      },
    }
  },
})
