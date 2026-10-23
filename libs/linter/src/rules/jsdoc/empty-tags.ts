/**
 * Tags that only mark a symbol, such as `@abstract`, `@async` or `@private`, carry no text: a
 * marker followed by a name, a type or a description is reported, and the fix empties its line.
 *
 * @module rules/jsdoc/empty-tags
 */

import type { Node } from '../../code/model'
import type { Fix } from '../../engine/report'
import type { JsdocBlock, JsdocLine, JsdocTag } from '../../jsdoc/parse'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule'
import { fileBlocks } from './shared/blocks'
import { replaceLine } from './shared/edits'
import { reportTag } from './shared/report'

/** The marker tags of the TypeScript flavour. */
const MARKERS = createSet<string>([
  'abstract',
  'async',
  'generator',
  'global',
  'hideconstructor',
  'ignore',
  'inheritDoc',
  'inner',
  'instance',
  'internal',
  'overload',
  'override',
  'readonly',
  'inheritdoc',
  'package',
  'private',
  'protected',
  'public',
  'static',
])

/**
 * Whether a text is made of asterisks alone, as the text before a block's close is when the
 * close has more than one.
 *
 * @param text - The text examined, trimmed
 * @returns Whether every character is an asterisk
 */
function isAsterisks(text: string): boolean {
  return [...text].every((char) => char === '*')
}

export default defineRule<undefined, Node>({
  id: 'jsdoc/empty-tags',
  language: 'code',
  fixable: true,
  create: (context) => ({
    Program() {
      for (const { block } of fileBlocks(context)) {
        const markers = block.tags.filter((tag) => MARKERS.has(tag.tag))
        markers.forEach((tag, index) => {
          const content = (tag.name || tag.description || tag.type).trim()
          // why: the last tag holds the extra asterisks of a close such as `**/`, which are no content.
          if (content === '' || (index === markers.length - 1 && isAsterisks(content))) return
          reportTag(context, tag, `@${tag.tag} should be empty.`, emptied(block, tag))
        })
      }
    },
  }),
})

/**
 * The fix emptying a tag's opening line: everything after the tag cleared, the delimiters and a
 * close on the line kept.
 *
 * @param block - The block holding the tag
 * @param tag - The marker tag whose line is emptied
 * @returns The replacement of the line
 */
function emptied(block: JsdocBlock, tag: JsdocTag): Fix {
  const line = tag.lines[0] as JsdocLine
  const { tokens } = line
  return replaceLine(block, line, {
    ...tokens,
    postTag: tokens.end === '' ? '' : ' ',
    type: '',
    postType: '',
    name: '',
    postName: '',
    description: '',
  })
}
