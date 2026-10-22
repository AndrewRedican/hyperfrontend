/**
 * Re-exports are listed type-only first, then by where their source points: Node built-ins,
 * external packages, the workspace scope, parent directories deepest first, the current
 * directory; alphabetical within each group. Exports of local declarations are not ordered.
 *
 * @module rules/workspace/export-order
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'
import { checkModuleOrder } from './shared/ordering.ts'

/** What is reported. */
const MESSAGE =
  'Exports are not in the correct order. Expected order: type exports first, then by source category (node: → external → @hyperfrontend → relative by depth → current directory).'

/**
 * Whether a statement re-exports from a source.
 *
 * @param statement - A top-level statement
 * @returns True for `export ... from` and `export * from`
 */
function isReexport(statement: Node): boolean {
  return statement.kind === 'ExportAllDeclaration' || (statement.kind === 'ExportNamedDeclaration' && statement.source !== null)
}

export default defineRule<undefined, Node>({
  id: 'workspace/export-order',
  language: 'code',
  fixable: true,
  create: (context) => ({
    Program(node) {
      const body = node.body as readonly Node[]
      checkModuleOrder(context, body, body.filter(isReexport), MESSAGE)
    },
  }),
})
