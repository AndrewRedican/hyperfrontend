/**
 * A `let`, `const`, `using`, function or class declared directly under a case clause is visible
 * to every clause of the switch yet initialised in one; braces give it a block of its own.
 *
 * @module rules/javascript/no-case-declarations
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'

export default defineRule<undefined, Node>({
  id: 'no-case-declarations',
  language: 'code',
  fixable: false,
  create: (context) => ({
    SwitchCase(node) {
      for (const statement of node.consequent as readonly Node[]) {
        if (!isLexicalDeclaration(statement)) continue
        context.report({ start: statement.start, end: statement.end, message: 'Unexpected lexical declaration in case block.' })
      }
    },
  }),
})

/**
 * Whether a statement declares a block-scoped binding: a variable declaration other than `var`,
 * a function or a class.
 *
 * @param statement - The statement tested
 * @returns Whether it is a lexical declaration
 */
function isLexicalDeclaration(statement: Node): boolean {
  if (statement.kind === 'VariableDeclaration') return statement.variableKind !== 'var'
  return statement.kind === 'FunctionDeclaration' || statement.kind === 'ClassDeclaration'
}
