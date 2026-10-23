/**
 * An assignment where a condition was expected is usually a mistyped comparison; one wrapped in
 * its own parentheses states that it is meant.
 *
 * @module rules/javascript/no-cond-assign
 */

import type { Node } from '../../code/model'
import type { RuleFile } from '../../engine/rule'
import { tokenAfter, tokenBefore } from '../../code/source'
import { defineRule } from '../../engine/rule'

export default defineRule<'except-parens' | undefined, Node>({
  id: 'no-cond-assign',
  language: 'code',
  fixable: false,
  create(context) {
    const check = (node: Node): void => {
      const test = node.test as Node | null
      if (test === null || test.kind !== 'AssignmentExpression') return
      // why: a for statement's parentheses are not its own, so one pair marks the assignment as meant; elsewhere it takes two.
      const needed = node.kind === 'ForStatement' ? 1 : 2
      if (parenthesisLayers(context.tree, context.file, test) >= needed) return
      context.report({ start: test.start, end: test.end, message: 'Expected a conditional expression and instead saw an assignment.' })
    }
    return {
      IfStatement: check,
      WhileStatement: check,
      DoWhileStatement: check,
      ForStatement: check,
      ConditionalExpression: check,
    }
  },
})

/**
 * How many pairs of parentheses sit directly around a node.
 *
 * @param program - The program whose tokens are read
 * @param file - The file linted
 * @param node - The node looked around
 * @returns The count of matching opening and closing parentheses on both sides
 */
function parenthesisLayers(program: Node, file: RuleFile, node: Node): number {
  let layers = 0
  let before = tokenBefore(program, node.start)
  let after = tokenAfter(program, node.end)
  while (before !== null && after !== null && file.text[before.start] === '(' && file.text[after.start] === ')') {
    layers += 1
    before = tokenBefore(program, before.start)
    after = tokenAfter(program, after.end)
  }
  return layers
}
