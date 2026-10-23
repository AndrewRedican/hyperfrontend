/**
 * A namespace import hides which exports a module uses and keeps bundlers from dropping the
 * rest; named imports say what is used. Type-only namespaces and JSON modules are allowed.
 *
 * @module rules/conventions/no-namespace-import
 */

import type { Node } from '../../code/model'
import { defineRule } from '../../engine/rule'
import { sourceOf } from './shared/sources'

export default defineRule<undefined, Node>({
  id: 'no-namespace-import',
  language: 'code',
  fixable: false,
  create: (context) => ({
    ImportNamespaceSpecifier(node) {
      const declaration = node.parent as Node
      if (declaration.importKind === 'type' || sourceOf(declaration).endsWith('.json')) return
      const name = (node.local as Node).name as string
      context.report({
        start: node.start,
        end: node.end,
        message: `Namespace import 'import * as ${name}' is not allowed. Use named imports 'import { ... }' to enable tree-shaking and make dependencies explicit.`,
      })
    },
  }),
})
