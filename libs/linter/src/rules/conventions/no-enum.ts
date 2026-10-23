/**
 * No `enum` declarations: a frozen const object says the same thing, tree-shakes and behaves the
 * same at compile time and at run time.
 *
 * @module rules/conventions/no-enum
 */

import type { Node } from '../../code/model'
import { defineRule } from '../../engine/rule'

/** The rule's options. */
export interface NoEnumOptions {
  /** The import statement the suggested replacement starts with, such as `import { freeze } from 'my-utils'`; the replacement then calls `freeze`. Absent, it calls `Object.freeze`. */
  readonly freezeImport?: string
}

export default defineRule<NoEnumOptions | undefined, Node>({
  id: 'no-enum',
  language: 'code',
  fixable: false,
  create(context) {
    return {
      TSEnumDeclaration(node) {
        const name = (node.id as Node).name as string
        const freezeImport = context.options?.freezeImport
        const replacement =
          freezeImport === undefined
            ? `const ${name} = Object.freeze(<const>{ Key: 'value' })`
            : `${freezeImport}\n  const ${name} = freeze(<const>{ Key: 'value' })`
        context.report({
          start: node.start,
          end: node.end,
          message: `The 'enum' keyword is not allowed. Use a frozen const object instead:\n  ${replacement}`,
        })
      },
    }
  },
})
