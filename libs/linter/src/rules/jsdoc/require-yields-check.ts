/**
 * A `@yields` tag promises values the generator yields: a documented function that yields no
 * value is reported, unless the tag's type admits `undefined`; a `never` type with a value
 * yielded is reported too, and so is a second `@yields`.
 *
 * @module rules/jsdoc/require-yields-check
 */

import type { Node } from '../../code/model'
import type { JsdocTag } from '../../jsdoc/parse'
import { defineRule } from '../../engine/rule'
import { admitsUndefined } from './shared/absent'
import { isUnimplemented } from './shared/exemptions'
import { documentedNodes } from './shared/functions'
import { reportBlock } from './shared/report'
import { yieldsValue } from './shared/yields'

export default defineRule<undefined, Node>({
  id: 'jsdoc/require-yields-check',
  language: 'code',
  fixable: false,
  create: (context) =>
    documentedNodes(context, (node, block) => {
      if (isUnimplemented(context, node, block)) return
      const tags = block.tags.filter((candidate) => candidate.tag === 'yields')
      if (tags.length === 0) return
      if (tags.length > 1) {
        reportBlock(context, block, 'Found more than one @yields declaration.')
        return
      }
      const tag = tags[0] as JsdocTag
      if (tag.type.trim() === 'never') {
        if (yieldsValue(node))
          reportBlock(context, block, 'JSDoc @yields declaration set with "never" but yield expression is present in function.')
        return
      }
      if (!admitsUndefined(tag) && !yieldsValue(node)) {
        reportBlock(context, block, 'JSDoc @yields declaration present but yield expression not available in function.')
      }
    }),
})
