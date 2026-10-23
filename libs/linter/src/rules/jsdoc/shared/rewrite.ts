/**
 * Fixes that rewrite a whole block from the tokens of its lines, or remove it: the previous
 * linter's fixes replaced the comment as a whole, and one left without tags or description
 * went away with the whitespace that held it on its own line.
 *
 * @module rules/jsdoc/shared/rewrite
 */

import type { Fix } from '../../../engine/report'
import type { JsdocBlock, JsdocTag, JsdocTokens } from '../../../jsdoc/parse'
import { stringifyLine } from '../../../jsdoc/parse'

/** The tokens a tag's line loses when the tag goes but the line stays. */
const TAG_TOKENS = ['postDelimiter', 'tag', 'postTag', 'type', 'postType', 'name', 'postName', 'description'] as const

/**
 * Copies the tokens of every line of a block, for a fix to change.
 *
 * @param block - The block copied
 * @returns The lines' tokens, in order
 *
 * @example Copy the tokens so a fix can change them freely
 * ```ts
 * const lines = blockTokens(block)
 * lines[2].tag = '@version'
 * block.lines[2].tokens.tag // => '@since' (the block is untouched)
 * ```
 */
export function blockTokens(block: JsdocBlock): JsdocTokens[] {
  return block.lines.map((line) => ({ ...line.tokens }))
}

/**
 * The fix replacing a block with the given lines; the first line's indentation stays as written.
 *
 * @param block - The block replaced
 * @param lines - The new lines' tokens
 * @returns The replacement
 *
 * @example Rename a tag across the block
 * ```ts
 * // block: Reads the port., then a since tag, at offset 12
 * const lines = blockTokens(block)
 * lines[2].tag = '@version'
 * rewriteBlock(block, lines)
 * // => { start: 12, end: 54,
 * //      text: '/**\n * Reads the port.\n * @version 1.0.0\n *\/' }
 * ```
 */
export function rewriteBlock(block: JsdocBlock, lines: readonly JsdocTokens[]): Fix {
  const indent = block.start - (block.lines[0] as JsdocBlock['lines'][number]).offset
  return { start: block.start, end: block.end, text: lines.map(stringifyLine).join('\n').slice(indent) }
}

/**
 * The fix removing a block: with the line break and indentation before it when nothing else
 * precedes it on its line, else with the spaces and line break after it.
 *
 * @param text - The file's text
 * @param block - The block removed
 * @returns The removal
 *
 * @example Remove a block on its own line, or one after code
 * ```ts
 * // a block on lines 2 to 5, after 'const a = 1\n'
 * removeBlock(text, block) // => { start: 11, end: 54, text: '' }
 * // a block after code on its line takes the spaces after it
 * removeBlock(trailingText, trailing) // => { start: 12, end: 26, text: '' }
 * ```
 */
export function removeBlock(text: string, block: JsdocBlock): Fix {
  const lineStart = text.lastIndexOf('\n', block.start - 1) + 1
  if (lineStart > 0 && text.slice(lineStart, block.start).trim() === '') return { start: lineStart - 1, end: block.end, text: '' }
  let end = block.end
  while (text[end] === ' ' || text[end] === '\t') end += 1
  if (text[end] === '\n') end += 1
  return { start: block.start, end, text: '' }
}

/**
 * The fix removing a tag from a block: its opening line and the continuation lines that do not
 * close the block go; a tag on the `/**` line beside other tags only empties that line; a block
 * left without tags or description is removed.
 *
 * @param text - The file's text
 * @param block - The block holding the tag
 * @param tag - The tag removed
 * @returns The fix
 *
 * @example Drop a tag, or the whole block when nothing else is left
 * ```ts
 * // block: Reads the port., then a since tag
 * removeTag(text, block, block.tags[0])
 * // => { start: 12, end: 54, text: '/**\n * Reads the port.\n *\/' }
 * // a block holding only an internal tag goes entirely
 * removeTag(internalText, internalBlock, internalBlock.tags[0])
 * // => { start: 0, end: 21, text: '' }
 * ```
 */
export function removeTag(text: string, block: JsdocBlock, tag: JsdocTag): Fix {
  if (block.tags.length === 1 && block.description.trim() === '') return removeBlock(text, block)
  const lines = blockTokens(block)
  const first = lines[tag.index] as JsdocTokens
  if (tag.index === 0 || first.end !== '') {
    for (const token of TAG_TOKENS) first[token] = ''
    return rewriteBlock(block, lines)
  }
  let count = 1
  while (count < tag.lines.length && (tag.lines[count] as JsdocBlock['lines'][number]).tokens.end === '') count += 1
  lines.splice(tag.index, count)
  return rewriteBlock(block, lines)
}
