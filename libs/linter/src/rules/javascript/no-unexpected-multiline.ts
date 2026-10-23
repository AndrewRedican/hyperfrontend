/**
 * Without a semicolon, a line that starts with `(`, `[`, a template or a regular expression
 * continues the statement before it as a call, a property access, a tagged template or a
 * division, which is rarely what the line break meant.
 *
 * @module rules/javascript/no-unexpected-multiline
 */

import type { Node, SourceToken } from '../../code/model'
import { tokenAfter, tokenBefore, tokenText } from '../../code/source'
import { defineRule } from '../../engine/rule'
import { positionAt } from '../../text/lines'

/** The letters a regular expression's flags are made of. */
const FLAGS = 'dgimsuvy'

export default defineRule<undefined, Node>({
  id: 'no-unexpected-multiline',
  language: 'code',
  fixable: false,
  create(context) {
    const { tree, file } = context
    const lineOf = (offset: number): number => positionAt(file.lines, offset).line
    const checkBreakAfter = (node: Node, message: string): void => {
      let open = tokenAfter(tree, node.end) as SourceToken
      while (file.text[open.start] === ')') open = tokenAfter(tree, open.end) as SourceToken
      const before = tokenBefore(tree, open.start) as SourceToken
      if (lineOf(open.start) === lineOf(before.end)) return
      context.report({ start: open.start, end: open.end, message })
    }
    return {
      MemberExpression(node) {
        if (node.computed !== true || node.optional === true) return
        checkBreakAfter(node.object as Node, 'Unexpected newline between object and [ of property access.')
      },
      TaggedTemplateExpression(node) {
        const quasi = node.quasi as Node
        const before = tokenBefore(tree, quasi.start) as SourceToken
        if (lineOf(before.end) === lineOf(quasi.start)) return
        context.report({
          start: quasi.start,
          end: quasi.start + 1,
          message: 'Unexpected newline between template tag and template literal.',
        })
      },
      CallExpression(node) {
        if ((node.arguments as readonly Node[]).length === 0 || node.optional === true) return
        checkBreakAfter(node.callee as Node, 'Unexpected newline between function and ( of function call.')
      },
      BinaryExpression(node) {
        // how: `a / b / c` is `(a / b) / c`; a regular expression read as two divisions shows up as the inner one.
        const parent = node.parent as Node
        if (node.operator !== '/' || parent.kind !== 'BinaryExpression' || parent.operator !== '/' || parent.left !== node) return
        let slash = tokenAfter(tree, node.end) as SourceToken
        while (file.text[slash.start] !== '/') slash = tokenAfter(tree, slash.end) as SourceToken
        const flags = tokenAfter(tree, slash.end) as SourceToken
        if (flags.category !== 'word' || flags.start !== slash.end || !isFlags(tokenText(file, flags))) return
        checkBreakAfter(node.left as Node, 'Unexpected newline between numerator and division operator.')
      },
    }
  },
})

/**
 * Whether a word is made of regular expression flags only.
 *
 * @param word - The word tested
 * @returns Whether every character is a flag letter
 */
function isFlags(word: string): boolean {
  for (const character of word) if (!FLAGS.includes(character)) return false
  return true
}
