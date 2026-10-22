/**
 * A JSX element that names the same attribute twice keeps only the later value; the repetition
 * is reported on each attribute after the first. Namespaced attributes are left alone.
 *
 * @module rules/react/jsx-no-duplicate-props
 */

import type { Node } from '../../code/model.ts'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule.ts'

export default defineRule<undefined, Node>({
  id: 'react/jsx-no-duplicate-props',
  language: 'code',
  fixable: false,
  create: (context) => ({
    JSXOpeningElement(node) {
      const seen = createSet<string>()
      for (const attribute of node.attributes as readonly Node[]) {
        if (attribute.kind !== 'JSXAttribute') continue
        const name = attribute.name as Node
        if (name.kind !== 'JSXIdentifier') continue
        const text = name.name as string
        if (seen.has(text)) context.report({ start: attribute.start, end: attribute.end, message: 'No duplicate props allowed' })
        else seen.add(text)
      }
    },
  }),
})
