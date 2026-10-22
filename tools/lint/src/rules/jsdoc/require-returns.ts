/**
 * A function that gives back a value documents it with `@returns`, once: a documented function
 * returning a value without the tag is reported, and so is a block with the tag twice.
 *
 * @module rules/jsdoc/require-returns
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'
import { avoidsDocs, hasTag } from './shared/exemptions.ts'
import { documentedNodes } from './shared/functions.ts'
import { reportBlock } from './shared/report.ts'
import { returnsValue } from './shared/returns.ts'

/** Constructors are passed over; getters and setters are checked. */
const CHECKS = { checkConstructors: false, checkGetters: true, checkSetters: true }

/** The tags saying the block documents no callable whose result matters. */
const VOIDING = ['abstract', 'virtual', 'class', 'constructor', 'type', 'interface']

export default defineRule<undefined, Node>({
  id: 'jsdoc/require-returns',
  language: 'code',
  fixable: false,
  create: (context) =>
    documentedNodes(context, (node, block) => {
      if (avoidsDocs(context, node, block, CHECKS) || hasTag(block, VOIDING)) return
      const count = block.tags.filter((tag) => tag.tag === 'returns').length
      if (count > 1) reportBlock(context, block, 'Found more than one @returns declaration.')
      if (count === 0 && returnsValue(node)) reportBlock(context, block, 'Missing JSDoc @returns declaration.')
    }),
})
