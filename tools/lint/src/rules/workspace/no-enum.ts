/**
 * No `enum` declarations: a frozen const object says the same thing, tree-shakes and behaves the
 * same at compile time and at run time.
 *
 * @module rules/workspace/no-enum
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'

export default defineRule<undefined, Node>({
  id: 'workspace/no-enum',
  language: 'code',
  fixable: false,
  create(context) {
    return {
      TSEnumDeclaration(node) {
        const name = (node.id as Node).name as string
        context.report({
          start: node.start,
          end: node.end,
          message: `The 'enum' keyword is not allowed. Use a frozen const object instead:\n  import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'\n  const ${name} = freeze(<const>{ Key: 'value' })`,
        })
      },
    }
  },
})
