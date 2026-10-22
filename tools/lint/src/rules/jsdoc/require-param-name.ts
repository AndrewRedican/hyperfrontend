/**
 * A `@param` tag names the parameter it documents: a tag with no name after it, or none after
 * its type, is reported.
 *
 * @module rules/jsdoc/require-param-name
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'
import { documentedNodes } from './shared/functions.ts'
import { reportTag } from './shared/report.ts'

export default defineRule<undefined, Node>({
  id: 'jsdoc/require-param-name',
  language: 'code',
  fixable: false,
  create: (context) =>
    documentedNodes(context, (_node, block) => {
      for (const tag of block.tags) {
        if (tag.tag !== 'param' || tag.name !== '') continue
        // note: the previous linter's wording names the type when there is none and the tag when there is one.
        reportTag(context, tag, `There must be an identifier after @param ${tag.type === '' ? 'type' : 'tag'}.`)
      }
    }),
})
