/**
 * In TypeScript the signature carries the types: a type on a function's `@param` or `@returns`
 * tag, or on a class's `@property` tag, is reported, and the fix removes it.
 *
 * @module rules/jsdoc/no-types
 */

import type { Node } from '../../code/model'
import type { Fix } from '../../engine/report'
import type { JsdocBlock, JsdocTag } from '../../jsdoc/parse'
import { defineRule } from '../../engine/rule'
import { documentedNodes, FUNCTION_KINDS } from './shared/functions'
import { reportTag } from './shared/report'
import { blockTokens, rewriteBlock } from './shared/rewrite'

/** The tags of a signature's parts. */
const SIGNATURE_TAGS = ['param', 'arg', 'argument', 'returns', 'return']

/** The tags of a class's properties. */
const PROPERTY_TAGS = ['prop', 'property']

/**
 * The fix removing a tag's type from each of its lines, the space after the tag with it; a line
 * continuing the type keeps one space after its delimiter, as the previous linter laid it out.
 *
 * @param block - The block holding the tag
 * @param tag - The tag whose type goes
 * @returns The rewrite of the block
 */
function removeType(block: JsdocBlock, tag: JsdocTag): Fix {
  const lines = blockTokens(block)
  tag.lines.forEach((line, offset) => {
    const tokens = lines[tag.index + offset] as (typeof lines)[number]
    if (offset > 0 && tokens.type !== '') tokens.postDelimiter = tokens.postDelimiter.slice(0, 1)
    tokens.postTag = ''
    tokens.type = ''
  })
  return rewriteBlock(block, lines)
}

export default defineRule<undefined, Node>({
  id: 'jsdoc/no-types',
  language: 'code',
  fixable: true,
  create: (context) =>
    documentedNodes(
      context,
      (node, block) => {
        for (const tag of block.tags) {
          if (tag.type === '') continue
          if (SIGNATURE_TAGS.includes(tag.tag)) reportTag(context, tag, `Types are not permitted on @${tag.tag}.`, removeType(block, tag))
          else if (node.kind === 'ClassDeclaration' && PROPERTY_TAGS.includes(tag.tag)) {
            reportTag(context, tag, `Types are not permitted on @${tag.tag} in the supplied context.`, removeType(block, tag))
          }
        }
      },
      [...FUNCTION_KINDS, 'TSMethodSignature', 'ClassDeclaration']
    ),
})
