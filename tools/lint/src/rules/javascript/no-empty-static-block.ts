/**
 * An empty static block does nothing; a comment inside its braces states that the emptiness is
 * meant.
 *
 * @module rules/javascript/no-empty-static-block
 */

import type { Node, SourceToken } from '../../code/model.ts'
import { commentsBetween, tokensBetween } from '../../code/source.ts'
import { defineRule } from '../../engine/rule.ts'

export default defineRule<undefined, Node>({
  id: 'no-empty-static-block',
  language: 'code',
  fixable: false,
  create: (context) => ({
    StaticBlock(node) {
      if ((node.body as readonly Node[]).length > 0) return
      // why: the block begins at `static`; the braces are what is reported, and a comment between them keeps the block.
      const open = tokensBetween(context.tree, node.start, node.end).find((token) => context.file.text[token.start] === '{') as SourceToken
      if (commentsBetween(context.file, open.end, node.end).length > 0) return
      context.report({ start: open.start, end: node.end, message: 'Unexpected empty static block.' })
    },
  }),
})
