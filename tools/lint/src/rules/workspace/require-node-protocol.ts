/**
 * A Node built-in is imported through the `node:` protocol, which names it unambiguously and
 * keeps a package of the same name from shadowing it.
 *
 * @module rules/workspace/require-node-protocol
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'
import { isBuiltinModule } from './shared/sources.ts'

export default defineRule<undefined, Node>({
  id: 'workspace/require-node-protocol',
  language: 'code',
  fixable: true,
  create: (context) => ({
    ImportDeclaration(node) {
      const literal = node.source as Node
      const source = literal.value as string
      if (source.startsWith('node:') || !isBuiltinModule(source)) return
      const fixed = `node:${source}`
      const quote = (literal.raw as string)[0] as string
      context.report({
        start: literal.start,
        end: literal.end,
        message: `Import from '${source}' must use '${fixed}' prefix. Node.js built-in modules require the node: protocol for clarity and to avoid npm package name collisions.`,
        fix: { start: literal.start, end: literal.end, text: `${quote}${fixed}${quote}` },
      })
    },
  }),
})
