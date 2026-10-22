/**
 * The check of the rules rejecting a type name outright, such as `any` or `Function`: each use
 * in a tag's type, at any depth, is reported on the tag's line.
 *
 * @module rules/jsdoc/shared/rejected-types
 */

import type { Node } from '../../../code/model.ts'
import type { RuleContext } from '../../../engine/rule.ts'
import type { Listeners } from '../../../engine/traverse.ts'
import { fileBlocks } from './blocks.ts'
import { reportTag } from './report.ts'
import { isCheckedName, typedTags, typeVisits } from './type-walk.ts'

/**
 * Listeners reporting every use of the rejected names; `*` stands for the any type.
 *
 * @param context - The rule's context
 * @param rejected - The names rejected, each with the text shown for it
 * @returns The listeners reporting the uses
 */
export function rejectedTypeListeners(context: RuleContext<unknown, Node>, rejected: ReadonlyMap<string, string>): Listeners<Node> {
  return {
    Program() {
      for (const { block } of fileBlocks(context)) {
        for (const { tag, root } of typedTags(block)) {
          for (const visit of typeVisits(root)) {
            const name = visit.node.kind === 'any' ? '*' : isCheckedName(visit) ? (visit.node.value as string) : null
            const message = name === null ? undefined : rejected.get(name)
            if (message !== undefined) reportTag(context, tag, message)
          }
        }
      }
    },
  }
}
