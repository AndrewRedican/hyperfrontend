/**
 * A `@property` tag says what the property holds: a tag whose description is empty is reported.
 *
 * @module rules/jsdoc/require-property-description
 */

import type { Node } from '../../code/model'
import { defineRule } from '../../engine/rule'
import { fileBlocks } from './shared/blocks'
import { reportTag } from './shared/report'

export default defineRule<undefined, Node>({
  id: 'jsdoc/require-property-description',
  language: 'code',
  fixable: false,
  create: (context) => ({
    Program() {
      for (const { block } of fileBlocks(context)) {
        for (const tag of block.tags) {
          if (tag.tag === 'property' && tag.description.trim() === '')
            reportTag(context, tag, `Missing JSDoc @property "${tag.name}" description.`)
        }
      }
    },
  }),
})
