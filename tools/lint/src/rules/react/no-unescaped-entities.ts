/**
 * Characters in JSX text that read as markup, or that are easy to mistype for a closing brace
 * or quote, are reported at each occurrence with the entities that escape them.
 *
 * @module rules/react/no-unescaped-entities
 */

import type { Node } from '../../code/model.ts'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { defineRule } from '../../engine/rule.ts'

/** The characters reported, each with the entities offered in its place. */
const FORBIDDEN = createMap<string, readonly string[]>([
  ['>', ['&gt;']],
  ['"', ['&quot;', '&ldquo;', '&#34;', '&rdquo;']],
  ["'", ['&apos;', '&lsquo;', '&#39;', '&rsquo;']],
  ['}', ['&#125;']],
])

export default defineRule<undefined, Node>({
  id: 'react/no-unescaped-entities',
  language: 'code',
  fixable: false,
  create: (context) => ({
    JSXText(node) {
      const text = context.file.text
      for (let offset = node.start; offset < node.end; offset += 1) {
        const alternatives = FORBIDDEN.get(text[offset] as string)
        if (alternatives === undefined) continue
        const listed = alternatives.map((alternative) => `\`${alternative}\``).join(', ')
        context.report({ start: offset, message: `\`${text[offset] as string}\` can be escaped with ${listed}.` })
      }
    },
  }),
})
