import type { JsonPropertyNode } from '../../languages/json-tree'
import type { JsonTreeNode } from '../../languages/json'
import { defineRule } from '../../engine/rule'
import { propertyOf } from '../../rules/shared/json'

const MESSAGE = 'Remove the "main" field. The "exports" field should be used instead for modern Node.js resolution.'

/**
 * A rule a family registers in the specs: reports a manifest's `main` field and removes it.
 */
export default defineRule<undefined, JsonTreeNode>({
  id: 'fixture/no-main',
  language: 'json',
  fixable: true,
  create(context) {
    return {
      document(node) {
        if (node.kind !== 'document' || node.root.kind !== 'object') return
        const properties: readonly JsonPropertyNode[] = node.root.properties
        const main = propertyOf(node.root, 'main')
        if (main === null) return
        const index = properties.indexOf(main)
        const fix =
          index > 0
            ? { start: (properties[index - 1] as JsonPropertyNode).end, end: main.end, text: '' }
            : { start: main.start, end: (properties[1] as JsonPropertyNode).start, text: '' }
        context.report({ start: main.start, end: main.end, message: MESSAGE, fix: properties.length > 1 ? fix : undefined })
      },
    }
  },
})
