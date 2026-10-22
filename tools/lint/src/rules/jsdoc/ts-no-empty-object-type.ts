/**
 * `{}` as a type admits every value but `null` and `undefined`, which is rarely what a block
 * means: each empty object type in a tag's type is reported.
 *
 * @module rules/jsdoc/ts-no-empty-object-type
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'
import { typeNodes } from '../../jsdoc/types.ts'
import { fileBlocks } from './shared/blocks.ts'
import { reportTag } from './shared/report.ts'
import { typedTags } from './shared/type-walk.ts'

export default defineRule<undefined, Node>({
  id: 'jsdoc/ts-no-empty-object-type',
  language: 'code',
  fixable: false,
  create: (context) => ({
    Program() {
      for (const { block } of fileBlocks(context)) {
        for (const { tag, root } of typedTags(block)) {
          for (const item of typeNodes(root)) {
            if (item.kind === 'object' && (item.elements as readonly unknown[]).length === 0)
              reportTag(context, tag, 'No empty object type.')
          }
        }
      }
    },
  }),
})
