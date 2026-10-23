/**
 * Fixes that rewrite one line of a block from its tokens. The first line of a block may follow
 * code on its line, which the parser reads as indentation; its replacement starts at `/**`.
 *
 * @module rules/jsdoc/shared/edits
 */

import type { Fix } from '../../../engine/report'
import type { JsdocBlock, JsdocLine, JsdocTokens } from '../../../jsdoc/parse'
import { stringifyLine } from '../../../jsdoc/parse'

/**
 * The fix replacing a line of a block with the line the tokens give.
 *
 * @param block - The block holding the line
 * @param line - The line replaced
 * @param tokens - The line's new tokens; on the block's first line, the indentation is left as it was
 * @returns The replacement
 *
 * @example Collapse the spacing of a tag line
 * ```ts
 * // block.lines[1] reads ' * @param  name  The user', at offset 4
 * const line = block.lines[1]
 * replaceLine(block, line, { ...line.tokens, postTag: ' ', postName: ' ' })
 * // => { start: 4, end: 29, text: ' * @param name The user' }
 * ```
 */
export function replaceLine(block: JsdocBlock, line: JsdocLine, tokens: JsdocTokens): Fix {
  const end = line.offset + stringifyLine(line.tokens).length
  const text = stringifyLine(tokens)
  if (line !== block.lines[0]) return { start: line.offset, end, text }
  return { start: block.start, end, text: text.slice(block.start - line.offset) }
}
