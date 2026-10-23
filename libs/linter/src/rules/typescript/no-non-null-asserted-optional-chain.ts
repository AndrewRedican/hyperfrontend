/**
 * An optional chain yields `undefined` when a link is missing; a non-null assertion on the
 * whole chain, at its end or around its parentheses, denies that on purpose and is wrong.
 *
 * @module rules/typescript/no-non-null-asserted-optional-chain
 */

import type { Node } from '../../code/model'
import { defineRule } from '../../engine/rule'

/** The one message the rule reports, whichever shape the assertion takes. */
const MESSAGE = 'Optional chain expressions can return undefined by design - using a non-null assertion is unsafe and wrong.'

export default defineRule<undefined, Node>({
  id: 'typescript/no-non-null-asserted-optional-chain',
  language: 'code',
  fixable: false,
  create: (context) => ({
    ChainExpression(node) {
      // why: a parenthesised chain under an assertion keeps its own node; the chain is what is reported.
      if ((node.parent as Node).kind !== 'TSNonNullExpression') return
      context.report({ start: node.start, end: node.end, message: MESSAGE })
    },
    TSNonNullExpression(node) {
      // why: an assertion that ends a chain sits directly under the chain node; the assertion is what is reported.
      if ((node.parent as Node).kind !== 'ChainExpression') return
      context.report({ start: node.start, end: node.end, message: MESSAGE })
    },
  }),
})
