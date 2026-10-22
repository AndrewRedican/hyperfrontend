/**
 * The check shared by `@param` and `@property` names: a dotted path such as `options.radix`
 * follows the tag naming its root, as the previous linter checked them in order.
 *
 * @module rules/jsdoc/shared/tag-paths
 */

import type { Node } from '../../../code/model.ts'
import type { RuleContext } from '../../../engine/rule.ts'
import type { JsdocTag } from '../../../jsdoc/parse.ts'
import { reportTag } from './report.ts'

/**
 * Reports the first dotted path that comes before any plain name, or whose root differs from
 * the plain name before it; `name[].path` roots at `name`.
 *
 * @param context - The rule's context
 * @param tags - The tags naming roots and paths, in order
 * @param label - The tag's name, such as `param`
 * @param noun - What a plain name is called in the messages, such as `parameter`
 */
export function checkPathRoots(context: RuleContext<unknown, Node>, tags: readonly JsdocTag[], label: string, noun: string): void {
  let last: string | undefined
  tags.some((tag) => {
    const { name } = tag
    if (!name.includes('.')) {
      last = name
      return false
    }
    if (last === undefined) {
      reportTag(context, tag, `@${label} path declaration ("${name}") appears before any real ${noun}.`)
      return true
    }
    let root = name.slice(0, name.indexOf('.'))
    if (root.endsWith('[]')) root = root.slice(0, -2)
    if (root === last) return false
    reportTag(
      context,
      tag,
      `@${label} path declaration ("${name}") root node name ("${root}") does not match previous real ${noun} name ("${last}").`
    )
    return true
  })
}
