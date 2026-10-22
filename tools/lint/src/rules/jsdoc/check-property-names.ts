/**
 * The `@property` tags of a block name each property once per `@typedef`, and a dotted path
 * follows the tag naming its root.
 *
 * @module rules/jsdoc/check-property-names
 */

import type { Node } from '../../code/model.ts'
import type { JsdocTag } from '../../jsdoc/parse.ts'
import { defineRule } from '../../engine/rule.ts'
import { fileBlocks } from './shared/blocks.ts'
import { reportTag } from './shared/report.ts'
import { checkPathRoots } from './shared/tag-paths.ts'

/**
 * The groups duplicates are looked for in: the tags of each `@typedef` up to the next when a
 * block defines several, else all of them.
 *
 * @param tags - The block's tags
 * @returns The tag lists searched apart
 */
function groupsOf(tags: readonly JsdocTag[]): JsdocTag[][] {
  const starts = tags.flatMap((tag, index) => (tag.tag === 'typedef' ? [index] : []))
  if (starts.length < 2) return [[...tags]]
  return starts.map((start, index) => tags.slice(start, starts[index + 1]))
}

export default defineRule<undefined, Node>({
  id: 'jsdoc/check-property-names',
  language: 'code',
  fixable: false,
  create: (context) => ({
    Program() {
      for (const { block } of fileBlocks(context)) {
        const properties = block.tags.filter((tag) => tag.tag === 'property')
        if (properties.length === 0) continue
        const duplicated = groupsOf(block.tags).some((group) => {
          const named = group.filter((tag) => tag.tag === 'property')
          return named.some((tag, index) => {
            const duplicate = named.find((other, at) => other.name === tag.name && at !== index)
            if (duplicate !== undefined) reportTag(context, duplicate, `Duplicate @property "${tag.name}"`)
            return duplicate !== undefined
          })
        })
        if (!duplicated) checkPathRoots(context, properties, 'property', 'property')
      }
    },
  }),
})
