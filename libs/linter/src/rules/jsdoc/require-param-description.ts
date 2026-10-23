/**
 * A `@param` tag documents a parameter with words, not its name alone: a tag whose description
 * is empty is reported.
 *
 * @module rules/jsdoc/require-param-description
 */

import type { Node } from '../../code/model'
import { defineRule } from '../../engine/rule'
import { documentedNodes } from './shared/functions'
import { reportTag } from './shared/report'

export default defineRule<undefined, Node>({
  id: 'jsdoc/require-param-description',
  language: 'code',
  fixable: false,
  create: (context) =>
    documentedNodes(context, (_node, block) => {
      for (const tag of block.tags) {
        if (tag.tag === 'param' && tag.description.trim() === '') reportTag(context, tag, `Missing JSDoc @param "${tag.name}" description.`)
      }
    }),
})
