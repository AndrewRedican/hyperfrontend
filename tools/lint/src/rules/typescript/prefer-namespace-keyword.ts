/**
 * `module Name {}` declares a namespace with a keyword that reads as an ES module; the keyword
 * is replaced by `namespace`. An ambient module named by a string, `declare module 'name'`,
 * is a different construct and passes.
 *
 * @module rules/typescript/prefer-namespace-keyword
 */

import type { Node, SourceToken } from '../../code/model.ts'
import { tokensBetween, tokenText } from '../../code/source.ts'
import { defineRule } from '../../engine/rule.ts'

export default defineRule<undefined, Node>({
  id: 'typescript/prefer-namespace-keyword',
  language: 'code',
  fixable: true,
  create: (context) => ({
    TSModuleDeclaration(node) {
      const id = node.id as Node
      if (node.moduleKind !== 'module' || id.kind === 'Literal') return
      const keyword = tokensBetween(context.tree, node.start, id.start).find(
        (token) => tokenText(context.file, token) === 'module'
      ) as SourceToken
      context.report({
        start: node.start,
        end: node.end,
        message: "Use 'namespace' instead of 'module' to declare custom TypeScript modules.",
        fix: { start: keyword.start, end: keyword.end, text: 'namespace' },
      })
    },
  }),
})
