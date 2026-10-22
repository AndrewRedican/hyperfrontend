/**
 * `@implements` belongs on a class or a constructor: on any other documented function, each
 * such tag is reported.
 *
 * @module rules/jsdoc/implements-on-classes
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'
import { hasTag, memberKindOf } from './shared/exemptions.ts'
import { documentedNodes } from './shared/functions.ts'
import { reportTag } from './shared/report.ts'

export default defineRule<undefined, Node>({
  id: 'jsdoc/implements-on-classes',
  language: 'code',
  fixable: false,
  create: (context) =>
    documentedNodes(context, (node, block) => {
      if (memberKindOf(node) === 'constructor' || hasTag(block, ['class', 'constructor'])) return
      for (const tag of block.tags) {
        if (tag.tag === 'implements') reportTag(context, tag, '@implements used on a non-constructor function')
      }
    }),
})
