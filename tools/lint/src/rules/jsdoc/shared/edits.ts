/**
 * Fixes that rewrite one line of a block from its tokens. The first line of a block may follow
 * code on its line, which the parser reads as indentation; its replacement starts at `/**`.
 *
 * @module rules/jsdoc/shared/edits
 */

import type { Fix } from '../../../engine/report.ts'
import type { JsdocBlock, JsdocLine, JsdocTokens } from '../../../jsdoc/parse.ts'
import { stringifyLine } from '../../../jsdoc/parse.ts'

/**
 * The fix replacing a line of a block with the line the tokens give.
 *
 * @param block - The block holding the line
 * @param line - The line replaced
 * @param tokens - The line's new tokens; on the block's first line, the indentation is left as it was
 * @returns The replacement
 */
export function replaceLine(block: JsdocBlock, line: JsdocLine, tokens: JsdocTokens): Fix {
  const end = line.offset + stringifyLine(line.tokens).length
  const text = stringifyLine(tokens)
  if (line !== block.lines[0]) return { start: line.offset, end, text }
  return { start: block.start, end, text: text.slice(block.start - line.offset) }
}
