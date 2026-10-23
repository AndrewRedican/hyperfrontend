/**
 * A literal asserted or annotated as its own literal type, `'a' as 'a'` or `let x: 'a' = 'a'`,
 * repeats itself; `as const` says the same once. The assertion is rewritten; the annotation is
 * only reported, as removing it changes the declaration.
 *
 * @module rules/typescript/prefer-as-const
 */

import type { Node } from '../../code/model'
import type { RuleContext } from '../../engine/rule'
import { defineRule } from '../../engine/rule'

export default defineRule<undefined, Node>({
  id: 'typescript/prefer-as-const',
  language: 'code',
  fixable: true,
  create(context) {
    const checkAssertion = (node: Node): void => compare(context, node.expression as Node, node.typeAnnotation as Node, true)
    return {
      TSAsExpression: checkAssertion,
      TSTypeAssertion: checkAssertion,
      VariableDeclarator(node) {
        const annotation = (node.id as Node).typeAnnotation
        const init = node.init as Node | null
        if (init !== null && annotation !== undefined) compare(context, init, annotation.typeAnnotation as Node, false)
      },
      PropertyDefinition(node) {
        const annotation = node.typeAnnotation
        const value = node.value as Node | null
        if (value !== null && annotation !== undefined) compare(context, value, annotation.typeAnnotation as Node, false)
      },
    }
  },
})

/**
 * Reports a literal type that spells its value's literal.
 *
 * @param context - The rule context
 * @param value - The expression
 * @param type - The type it is asserted or annotated with
 * @param assertion - Whether the type is an assertion, which the fix rewrites to `const`
 */
function compare(context: RuleContext<undefined, Node>, value: Node, type: Node, assertion: boolean): void {
  if (value.kind !== 'Literal' || type.kind !== 'TSLiteralType') return
  const literal = type.literal as Node
  if (literal.kind !== 'Literal' || literal.raw !== value.raw) return
  context.report({
    start: type.start,
    end: type.end,
    message: assertion
      ? 'Expected a `const` instead of a literal type assertion.'
      : 'Expected a `const` assertion instead of a literal type annotation.',
    fix: assertion ? { start: type.start, end: type.end, text: 'const' } : undefined,
  })
}
