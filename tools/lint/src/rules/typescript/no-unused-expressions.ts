/**
 * An expression statement that neither calls, assigns, awaits nor yields does nothing with its
 * value; a bare literal, name, member access, operator expression or tagged template is
 * reported. A directive prologue string, a dynamic import and a JSX element pass, and a type
 * assertion, non-null assertion or instantiation is looked through to the expression under it.
 *
 * @module rules/typescript/no-unused-expressions
 */

import type { Node } from '../../code/model.ts'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule.ts'

/** The kinds of expression whose value is lost when it stands alone. */
const UNUSED = createSet<string>([
  'ArrayExpression',
  'ArrowFunctionExpression',
  'BinaryExpression',
  'ClassExpression',
  'ConditionalExpression',
  'FunctionExpression',
  'Identifier',
  'Literal',
  'LogicalExpression',
  'MemberExpression',
  'MetaProperty',
  'ObjectExpression',
  'SequenceExpression',
  'TaggedTemplateExpression',
  'TemplateLiteral',
  'ThisExpression',
])

/** The kinds that wrap an expression without using it. */
const WRAPPERS = createSet<string>([
  'ChainExpression',
  'TSAsExpression',
  'TSTypeAssertion',
  'TSNonNullExpression',
  'TSInstantiationExpression',
])

export default defineRule<undefined, Node>({
  id: 'typescript/no-unused-expressions',
  language: 'code',
  fixable: false,
  create: (context) => ({
    ExpressionStatement(node) {
      if (node.directive !== undefined) return
      let expression = node.expression as Node
      while (WRAPPERS.has(expression.kind)) expression = expression.expression as Node
      const unused =
        UNUSED.has(expression.kind) ||
        (expression.kind === 'UnaryExpression' && expression.operator !== 'void' && expression.operator !== 'delete')
      if (!unused) return
      context.report({
        start: node.start,
        end: node.end,
        message: 'Expected an assignment or function call and instead saw an expression.',
      })
    },
  }),
})
