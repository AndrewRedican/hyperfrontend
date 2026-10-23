/**
 * The check of the rules requiring a tag's type: every JSDoc block of the file, attached or
 * not, with one of the tags written without a type is reported once, as a whole.
 *
 * @module rules/jsdoc/shared/typed-tags
 */

import type { Node } from '../../../code/model'
import type { RuleContext } from '../../../engine/rule'
import type { Listeners } from '../../../engine/traverse'
import { fileBlocks } from './blocks'
import { reportBlock } from './report'

/**
 * Listeners reporting each block holding one of the tags without a type.
 *
 * @param context - The rule's context
 * @param names - The tag names checked, synonyms included
 * @param message - The text shown
 * @returns The listeners reporting untyped tags
 *
 * @example Require a type on every param tag and its synonyms
 * ```ts
 * create: (context) =>
 *   untypedTagListeners(context, ['param', 'arg', 'argument'], 'Missing JSDoc @param type.')
 * // a block holding an untyped param tag is reported once, over the whole block
 * ```
 */
export function untypedTagListeners(context: RuleContext<unknown, Node>, names: readonly string[], message: string): Listeners<Node> {
  return {
    Program() {
      for (const { block } of fileBlocks(context)) {
        if (block.tags.some((tag) => names.includes(tag.tag) && tag.type === '')) reportBlock(context, block, message)
      }
    },
  }
}
