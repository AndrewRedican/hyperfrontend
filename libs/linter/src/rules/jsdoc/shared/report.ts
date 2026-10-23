/**
 * Where the jsdoc rules report: a whole block, from `/**` to its close, or a tag's opening line
 * alone, at its first column, as the previous linter placed those reports.
 *
 * @module rules/jsdoc/shared/report
 */

import type { Node } from '../../../code/model'
import type { Fix } from '../../../engine/report'
import type { RuleContext } from '../../../engine/rule'
import type { JsdocBlock, JsdocLine, JsdocTag } from '../../../jsdoc/parse'
import { stringifyLine } from '../../../jsdoc/parse'

/**
 * Reports a problem over a whole block.
 *
 * @param context - The rule's context
 * @param block - The block reported
 * @param message - The text shown
 * @param fix - The fix offered, when one is
 *
 * @example Report a block missing a tag
 * ```ts
 * for (const { block } of fileBlocks(context)) {
 *   if (block.tags.length === 0) reportBlock(context, block, 'Missing JSDoc tags.')
 * }
 * // each report spans the block from its opening slash to its close
 * ```
 */
export function reportBlock(context: RuleContext<unknown, Node>, block: JsdocBlock, message: string, fix?: Fix): void {
  context.report({ start: block.start, end: block.end, message, fix })
}

/**
 * Reports a problem on one line of a block, the position naming the line alone.
 *
 * @param context - The rule's context
 * @param line - The line reported
 * @param message - The text shown
 * @param fix - The fix offered, when one is
 *
 * @example Report the third line of a block at column 1
 * ```ts
 * // a block opening on line 2; its third line is ' * @deprecated'
 * reportLine(context, block.lines[2], 'Deprecated tag found.')
 * // reports { start: 33, end: 47, at: { line: 4, column: 1, ... } }
 * ```
 */
export function reportLine(context: RuleContext<unknown, Node>, line: JsdocLine, message: string, fix?: Fix): void {
  const start = line.offset
  const at = { line: line.number, column: 1, endLine: line.number, endColumn: 1 }
  context.report({ start, end: start + stringifyLine(line.tokens).length, at, message, fix })
}

/**
 * Reports a problem on a line of the file given by number, the position naming the line alone.
 *
 * @param context - The rule's context
 * @param line - The 1-based line
 * @param message - The text shown
 *
 * @example Report a whole line by its number
 * ```ts
 * reportLineNumber(context, 6, 'Expected a blank line.')
 * // reports at { line: 6, column: 1, endLine: 6, endColumn: 1 }
 * ```
 */
export function reportLineNumber(context: RuleContext<unknown, Node>, line: number, message: string): void {
  const start = context.file.lines.starts[line - 1] as number
  context.report({ start, end: start, at: { line, column: 1, endLine: line, endColumn: 1 }, message })
}

/**
 * Reports a problem on the line a tag opens on.
 *
 * @param context - The rule's context
 * @param tag - The tag reported
 * @param message - The text shown
 * @param fix - The fix offered, when one is
 *
 * @example Report on the line a tag opens
 * ```ts
 * const deprecated = block.tags.find(({ tag }) => tag === 'deprecated')
 * if (deprecated !== undefined) reportTag(context, deprecated, 'Deprecated tag found.')
 * ```
 */
export function reportTag(context: RuleContext<unknown, Node>, tag: JsdocTag, message: string, fix?: Fix): void {
  reportLine(context, tag.lines[0] as JsdocLine, message, fix)
}
