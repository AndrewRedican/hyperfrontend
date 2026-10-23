/**
 * Re-exports are listed type-only first, then by where their source points: Node built-ins,
 * external packages, the configured internal scopes, parent directories deepest first, the current
 * directory; alphabetical within each group. Exports of local declarations are not ordered.
 *
 * @module rules/conventions/export-order
 */

import type { Node } from '../../code/model'
import type { OrderOptions } from './shared/ordering'
import { defineRule } from '../../engine/rule'
import { checkModuleOrder } from './shared/ordering'

/**
 * Whether a statement re-exports from a source.
 *
 * @param statement - A top-level statement
 * @returns True for `export ... from` and `export * from`
 */
function isReexport(statement: Node): boolean {
  return statement.kind === 'ExportAllDeclaration' || (statement.kind === 'ExportNamedDeclaration' && statement.source !== null)
}

export default defineRule<OrderOptions | undefined, Node>({
  id: 'export-order',
  language: 'code',
  fixable: true,
  create: (context) => ({
    Program(node) {
      const body = node.body as readonly Node[]
      checkModuleOrder(context, body, body.filter(isReexport), 'Exports')
    },
  }),
})
