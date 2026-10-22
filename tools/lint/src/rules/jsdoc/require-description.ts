/**
 * A block says what it documents in a plain description before its tags: a block without one
 * is reported, with a hint to drop `@desc` or `@description` when the description sits in one.
 *
 * @module rules/jsdoc/require-description
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'
import { avoidsDocs } from './shared/exemptions.ts'
import { documentedNodes } from './shared/functions.ts'
import { reportBlock } from './shared/report.ts'

/** Every member kind is checked. */
const CHECKS = { checkConstructors: true, checkGetters: true, checkSetters: true }

export default defineRule<undefined, Node>({
  id: 'jsdoc/require-description',
  language: 'code',
  fixable: false,
  create: (context) =>
    documentedNodes(context, (node, block) => {
      if (block.description.trim() !== '' || avoidsDocs(context, node, block, CHECKS)) return
      const tag = block.tags.find((candidate) => candidate.tag === 'desc' || candidate.tag === 'description')
      const message =
        tag === undefined
          ? 'Missing JSDoc block description.'
          : `Remove the @${tag.tag} tag to leave a plain block description or add additional description text above the @${tag.tag} line.`
      reportBlock(context, block, message)
    }),
})
