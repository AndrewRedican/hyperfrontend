/**
 * A type parameter constrained to `any` or `unknown` accepts every type, as an unconstrained
 * one does; the constraint is noise.
 *
 * @module rules/typescript/no-unnecessary-type-constraint
 */

import type { Node } from '../../code/model'
import { defineRule } from '../../engine/rule'

/** The constraints that constrain nothing, by the kind of their type node. */
const UNNECESSARY: Readonly<Record<string, string>> = { TSAnyKeyword: 'any', TSUnknownKeyword: 'unknown' }

export default defineRule<undefined, Node>({
  id: 'typescript/no-unnecessary-type-constraint',
  language: 'code',
  fixable: false,
  create: (context) => ({
    TSTypeParameter(node) {
      const constraint = node.constraint
      if (constraint === undefined || (node.parent as Node).kind !== 'TSTypeParameterDeclaration') return
      const name = UNNECESSARY[constraint.kind]
      if (name === undefined) return
      context.report({
        start: node.start,
        end: node.end,
        message: `Constraining the generic type \`${(node.name as Node).name as string}\` to \`${name}\` does nothing and is unnecessary.`,
      })
    },
  }),
})
