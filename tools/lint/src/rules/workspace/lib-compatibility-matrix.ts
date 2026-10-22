/**
 * The root compatibility document is generated from every package's `project.json` and
 * `package.json`; when it no longer matches them, the fix rewrites it.
 *
 * @module rules/workspace/lib-compatibility-matrix
 */

import type { RuleContext } from '../../engine/rule.ts'
import type { MarkdownNode } from '../../markdown/model.ts'
import { basename, dirname } from 'node:path'
import { buildCompatibilityDocument, COMPATIBILITY_DOCUMENT_NAME } from '@hyperfrontend/workspace'
import { defineRule } from '../../engine/rule.ts'
import { workspaceRootOf } from './shared/locate.ts'

const MESSAGE =
  'LIBRARY_COMPATIBILITY.md is generated from each package project.json and package.json, and no longer matches them. Run `npx nx lint:all` (or `nx lint @hyperfrontend/workspace --fix`) to regenerate it.'

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
