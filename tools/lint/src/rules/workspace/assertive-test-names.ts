/**
 * A test title states a fact: "returns null for empty input", not "should return null". The
 * word "should" in the title of an `it`, `test`, `fit`, `xit` or `xtest` call, modifiers and
 * table forms included, is reported; suite titles are left alone.
 *
 * @module rules/workspace/assertive-test-names
 */

import type { Node, TemplateValue } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'
import { testDeclaration } from './shared/tests.ts'

/** The text reported. */
const MESSAGE =
  'Test names should be assertive statements of fact. Avoid using "should" - use direct verbs like "returns", "throws", "handles" instead.'

/** The word in any letter case, on its own. */
const SHOULD = /\bshould\b/i

/**
 * The text of a title written as a string or a template without substitutions.
 *
 * @param title - The first argument of the declaring call
 * @returns The text, or null when the title is computed
 */
function titleText(title: Node): string | null {
  if (title.kind === 'Literal') return typeof title.value === 'string' ? title.value : null
  if (title.kind !== 'TemplateLiteral' || (title.expressions as readonly Node[]).length > 0) return null
  return (((title.quasis as readonly Node[])[0] as Node).value as TemplateValue).cooked as string
}

export default defineRule<undefined, Node>({
  id: 'workspace/assertive-test-names',
  language: 'code',
  fixable: false,
  create: (context) => ({
    CallExpression(node) {
      if (testDeclaration(node) === null) return
      const title = (node.arguments as readonly Node[])[0]
      if (title === undefined) return
      const text = titleText(title)
      if (text === null || !SHOULD.test(text)) return
      context.report({ start: title.start, end: title.end, message: MESSAGE })
    },
  }),
})
