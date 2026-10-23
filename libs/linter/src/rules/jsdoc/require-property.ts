/**
 * A `@typedef` or `@namespace` of a plain object type lists its properties: such a block
 * without a `@property` tag is reported once per object-typed tag, and the fix adds an empty
 * `@property` after the last tag's line.
 *
 * @module rules/jsdoc/require-property
 */

import type { Node } from '../../code/model'
import type { Fix } from '../../engine/report'
import type { JsdocBlock } from '../../jsdoc/parse'
import { defineRule } from '../../engine/rule'
import { fileBlocks } from './shared/blocks'
import { reportBlock } from './shared/report'
import { blockTokens, rewriteBlock } from './shared/rewrite'

/** The types that make a definition an object with properties. */
const OBJECT_TYPES = ['object', 'Object', 'PlainObject']

/**
 * The fix adding an empty `@property` line after the first line of the block's last tag.
 *
 * @param block - The block given the tag
 * @returns The rewrite of the block
 */
function addProperty(block: JsdocBlock): Fix {
  const lines = blockTokens(block)
  const last = block.tags[block.tags.length - 1] as JsdocBlock['tags'][number]
  const indent = (lines[0] as (typeof lines)[number]).start
  lines.splice(last.index + 1, 0, {
    start: `${indent} `,
    delimiter: '*',
    postDelimiter: ' ',
    tag: '@property',
    postTag: '',
    type: '',
    postType: '',
    name: '',
    postName: '',
    description: '',
    end: '',
    lineEnd: '',
  })
  return rewriteBlock(block, lines)
}

export default defineRule<undefined, Node>({
  id: 'jsdoc/require-property',
  language: 'code',
  fixable: true,
  create: (context) => ({
    Program() {
      for (const { block } of fileBlocks(context)) {
        if (block.tags.some((tag) => tag.tag === 'property')) continue
        for (const tag of block.tags) {
          if ((tag.tag === 'typedef' || tag.tag === 'namespace') && OBJECT_TYPES.includes(tag.type)) {
            reportBlock(context, block, 'Missing JSDoc @property.', addProperty(block))
          }
        }
      }
    },
  }),
})
