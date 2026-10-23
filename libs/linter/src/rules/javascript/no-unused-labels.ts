/**
 * A label no `break` or `continue` names is noise; it is removed, unless a comment sits
 * between it and its statement or removing it would turn a string into a directive.
 *
 * @module rules/javascript/no-unused-labels
 */

import type { Node } from '../../code/model'
import type { RuleFile } from '../../engine/rule'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { commentsBetween } from '../../code/source'
import { defineRule } from '../../engine/rule'

/** A label in scope and whether a jump has named it. */
interface Label {
  /** The labeled statement. */
  readonly node: Node
  /** The label's name. */
  readonly name: string
  /** Whether a `break` or `continue` named it. */
  used: boolean
}

/** The kinds of node whose body block opens a directive prologue. */
const FUNCTIONS = createSet<string>(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'])

export default defineRule<undefined, Node>({
  id: 'no-unused-labels',
  language: 'code',
  fixable: true,
  create(context) {
    const labels: Label[] = []
    const jump = (node: Node): void => {
      const label = node.label as Node | null
      if (label === null) return
      const name = label.name as string
      for (let index = labels.length - 1; index >= 0; index -= 1) {
        const candidate = labels[index] as Label
        if (candidate.name === name) {
          candidate.used = true
          return
        }
      }
    }
    return {
      LabeledStatement(node) {
        labels.push({ node, name: (node.label as Node).name as string, used: false })
      },
      'LabeledStatement:exit'(node) {
        const label = labels.pop() as Label
        if (label.used) return
        const identifier = node.label as Node
        const body = node.body as Node
        context.report({
          start: identifier.start,
          end: identifier.end,
          message: `'${label.name}:' is defined but never used.`,
          fix: isFixable(context.file, node, body) ? { start: node.start, end: body.start, text: '' } : undefined,
        })
      },
      BreakStatement: jump,
      ContinueStatement: jump,
    }
  },
})

/**
 * Whether removing a label is safe: no comment sits between it and its statement, and the
 * statement is no string literal that would become a directive in its prologue position.
 *
 * @param file - The file linted
 * @param node - The labeled statement
 * @param body - Its statement
 * @returns Whether to offer the fix
 */
function isFixable(file: RuleFile, node: Node, body: Node): boolean {
  if (commentsBetween(file, node.start, body.start).length > 0) return false
  if (!isStringStatement(body)) return true
  let outer = node
  while ((outer.parent as Node).kind === 'LabeledStatement') outer = outer.parent as Node
  const parent = outer.parent as Node
  const prologue = parent.kind === 'Program' || (parent.kind === 'BlockStatement' && FUNCTIONS.has((parent.parent as Node).kind))
  if (!prologue) return true
  const siblings = parent.body as readonly Node[]
  return !siblings.slice(0, siblings.indexOf(outer)).every((sibling) => sibling.directive !== undefined)
}

/**
 * Whether a statement is a string literal, or a template without substitutions, on its own.
 *
 * @param statement - The statement checked
 * @returns Whether removing a label before it could make it a directive
 */
function isStringStatement(statement: Node): boolean {
  if (statement.kind !== 'ExpressionStatement') return false
  const expression = statement.expression as Node
  if (expression.kind === 'Literal') return typeof expression.value === 'string'
  return expression.kind === 'TemplateLiteral' && (expression.expressions as readonly Node[]).length === 0
}
