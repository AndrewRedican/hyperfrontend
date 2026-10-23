/**
 * Imports are listed type-only first, then by where their source points: Node built-ins,
 * external packages, the configured internal scopes, parent directories deepest first, the current
 * directory; alphabetical within each group.
 *
 * @module rules/conventions/import-order
 */

import type { Node } from '../../code/model'
import type { OrderOptions } from './shared/ordering'
import { defineRule } from '../../engine/rule'
import { checkModuleOrder } from './shared/ordering'

export default defineRule<OrderOptions | undefined, Node>({
  id: 'import-order',
  language: 'code',
  fixable: true,
  create: (context) => ({
    Program(node) {
      const body = node.body as readonly Node[]
      checkModuleOrder(
        context,
        body,
        body.filter((statement) => statement.kind === 'ImportDeclaration'),
        'Imports'
      )
    },
  }),
})
