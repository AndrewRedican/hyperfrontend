/**
 * Access control is written once per block: an `@access` tag names a valid level, and is not
 * combined with `@package`, `@private`, `@protected` or `@public`, nor repeated.
 *
 * @module rules/jsdoc/check-access
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'
import { fileBlocks } from './shared/blocks.ts'
import { reportBlock, reportTag } from './shared/report.ts'

/** The access levels, which are also the tags naming one. */
const LEVELS = ['package', 'private', 'protected', 'public']

export default defineRule<undefined, Node>({
  id: 'jsdoc/check-access',
  language: 'code',
  fixable: false,
  create: (context) => ({
    Program() {
      for (const { block } of fileBlocks(context)) {
        const access = block.tags.filter((tag) => tag.tag === 'access')
        for (const tag of access) {
          if (!LEVELS.includes(tag.description.trim())) reportTag(context, tag, 'Missing valid JSDoc @access level.')
        }
        const specific = block.tags.filter((tag) => LEVELS.includes(tag.tag)).length
        if (access.length > 0 && specific > 0) {
          reportBlock(
            context,
            block,
            'The @access tag may not be used with specific access-control tags (@package, @private, @protected, or @public).'
          )
        }
        if (access.length > 1 || specific > 1)
          reportBlock(context, block, 'At most one access-control tag may be present on a JSDoc block.')
      }
    },
  }),
})
