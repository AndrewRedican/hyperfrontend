/**
 * Imports are listed type-only first, then by where their source points: Node built-ins,
 * external packages, the workspace scope, parent directories deepest first, the current
 * directory; alphabetical within each group.
 *
 * @module rules/workspace/import-order
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'
import { checkModuleOrder } from './shared/ordering.ts'

/** What is reported. */
const MESSAGE =
  'Imports are not in the correct order. Expected order: type imports first, then by source category (node: → external → @hyperfrontend → relative by depth → current directory).'

export default defineRule<undefined, Node>({
  id: 'workspace/import-order',
  language: 'code',
  fixable: true,
  create: (context) => ({
    Program(node) {
      const body = node.body as readonly Node[]
      checkModuleOrder(
        context,
        body,
        body.filter((statement) => statement.kind === 'ImportDeclaration'),
        MESSAGE
      )
    },
  }),
})
