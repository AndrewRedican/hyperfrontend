/**
 * A `@returns` tag promises a value the function gives: a documented function whose code
 * returns nothing on some path is reported, unless the tag's type admits `undefined`; a
 * `never` type with a value returned is reported too, and so is a second `@returns`.
 *
 * @module rules/jsdoc/require-returns-check
 */

import type { Node } from '../../code/model'
import type { JsdocTag } from '../../jsdoc/parse'
import { defineRule } from '../../engine/rule'
import { admitsUndefined } from './shared/absent'
import { isUnimplemented } from './shared/exemptions'
import { documentedNodes } from './shared/functions'
import { reportBlock } from './shared/report'
import { returnsOnEveryPath, returnsValue } from './shared/returns'

export default defineRule<undefined, Node>({
  id: 'jsdoc/require-returns-check',
  language: 'code',
  fixable: false,
  create: (context) =>
    documentedNodes(context, (node, block) => {
      // why: an async function's value is its promise's, which this rule does not follow.
      if (node.async === true || isUnimplemented(context, node, block)) return
      const tags = block.tags.filter((candidate) => candidate.tag === 'returns')
      if (tags.length === 0) return
      if (tags.length > 1) {
        reportBlock(context, block, 'Found more than one @returns declaration.')
        return
      }
      const tag = tags[0] as JsdocTag
      const type = tag.type.trim()
      // why: an assertion signature returns nothing; it narrows its argument.
      if (/asserts\s/.test(type)) return
      if (type === 'never') {
        if (returnsValue(node))
          reportBlock(context, block, 'JSDoc @returns declaration set with "never" but return expression is present in function.')
        return
      }
      if (admitsUndefined(tag) || node.generator === true) return
      const returns = tag.type === '' ? returnsValue(node, true) : returnsOnEveryPath(node, true)
      if (!returns) reportBlock(context, block, 'JSDoc @returns declaration present but return expression not available in function.')
    }),
})
