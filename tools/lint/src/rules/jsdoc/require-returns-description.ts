/**
 * A `@returns` tag says what comes back, unless its type says nothing does: a tag with an empty
 * description is reported, except when its type is `void`, `undefined` or a promise of either.
 *
 * @module rules/jsdoc/require-returns-description
 */

import type { Node } from '../../code/model.ts'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule.ts'
import { documentedNodes } from './shared/functions.ts'
import { reportTag } from './shared/report.ts'

/** The types that return nothing worth describing. */
const NOTHING = createSet<string>(['undefined', 'void', 'Promise<undefined>', 'Promise<void>'])

export default defineRule<undefined, Node>({
  id: 'jsdoc/require-returns-description',
  language: 'code',
  fixable: false,
  create: (context) =>
    documentedNodes(context, (_node, block) => {
      for (const tag of block.tags) {
        if (tag.tag !== 'returns' || NOTHING.has(tag.type.trim()) || tag.description.trim() !== '') continue
        reportTag(context, tag, 'Missing JSDoc @returns description.')
      }
    }),
})
