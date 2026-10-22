/**
 * A `@property` tag names the property it documents: a tag with no name after it, or none
 * after its type, is reported.
 *
 * @module rules/jsdoc/require-property-name
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'
import { fileBlocks } from './shared/blocks.ts'
import { reportTag } from './shared/report.ts'

export default defineRule<undefined, Node>({
  id: 'jsdoc/require-property-name',
  language: 'code',
  fixable: false,
  create: (context) => ({
    Program() {
      for (const { block } of fileBlocks(context)) {
        for (const tag of block.tags) {
          if (tag.tag !== 'property' || tag.name !== '') continue
          // note: the previous linter's wording names the type when there is none and the tag when there is one.
          reportTag(context, tag, `There must be an identifier after @property ${tag.type === '' ? 'type' : 'tag'}.`)
        }
      }
    },
  }),
})
