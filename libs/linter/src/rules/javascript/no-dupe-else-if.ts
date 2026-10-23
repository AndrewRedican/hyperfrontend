/**
 * A branch of an if-else-if chain whose condition repeats an earlier one, or is implied by the
 * earlier conditions taken together, can never run.
 *
 * @module rules/javascript/no-dupe-else-if
 */

import type { Node } from '../../code/model'
import { defineRule } from '../../engine/rule'
import { sameTokens } from './shared/tokens'

/** A condition split into the operands of one logical operator, each split again by the other. */
type Operands = readonly (readonly Node[])[]

export default defineRule<undefined, Node>({
  id: 'no-dupe-else-if',
  language: 'code',
  fixable: false,
  create(context) {
    const equal = (a: Node, b: Node): boolean => {
      if (a.kind !== b.kind) return false
      if (a.kind === 'LogicalExpression' && (a.operator === '||' || a.operator === '&&') && a.operator === b.operator) {
        const [aLeft, aRight, bLeft, bRight] = [a.left as Node, a.right as Node, b.left as Node, b.right as Node]
        return (equal(aLeft, bLeft) && equal(aRight, bRight)) || (equal(aLeft, bRight) && equal(aRight, bLeft))
      }
      return sameTokens(context.tree, context.file, a, b)
    }
    const isSubset = (a: readonly Node[], b: readonly Node[]): boolean => a.every((x) => b.some((y) => equal(x, y)))
    const operandsOf = (condition: Node): Operands => splitBy('||', condition).map((operand) => splitBy('&&', operand))
    return {
      IfStatement(node) {
        const test = node.test as Node
        const conditions = test.kind === 'LogicalExpression' && test.operator === '&&' ? [test, ...splitBy('&&', test)] : [test]
        let remaining: Operands[] = conditions.map(operandsOf)
        let current = node
        while ((current.parent as Node).kind === 'IfStatement' && (current.parent as Node).alternate === current) {
          current = current.parent as Node
          const covered = operandsOf(current.test as Node)
          remaining = remaining.map((operands) => operands.filter((operand) => !covered.some((earlier) => isSubset(earlier, operand))))
          if (remaining.some((operands) => operands.length === 0)) {
            context.report({
              start: test.start,
              end: test.end,
              message:
                'This branch can never execute. Its condition is a duplicate or covered by previous conditions in the if-else-if chain.',
            })
            return
          }
        }
      },
    }
  },
})

/**
 * The operands of a logical expression with a given operator, nested ones flattened; any other
 * node is its own only operand.
 *
 * @param operator - `||` or `&&`
 * @param node - The expression split
 * @returns Its operands, in source order
 */
function splitBy(operator: string, node: Node): readonly Node[] {
  if (node.kind !== 'LogicalExpression' || node.operator !== operator) return [node]
  return [...splitBy(operator, node.left as Node), ...splitBy(operator, node.right as Node)]
}
