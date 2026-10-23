/**
 * `typeof` yields one of a few strings; a comparison of it to any other value, or to a misspelt
 * type name, can never hold.
 *
 * @module rules/javascript/valid-typeof
 */

import type { Node, TemplateValue } from '../../code/model'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule'
import { scopeAnalysisOf } from '../../scope/analysis'
import { isGlobalReference } from './shared/constant'

/** The rule's options; the workspace runs the rule in its default mode, the only one implemented. */
export interface ValidTypeofOptions {
  /** Whether a comparison to anything but a string literal is reported; only `false`, the default, is implemented. */
  readonly requireStringLiterals?: false
}

/** A value a comparison names outright. */
interface LiteralValue {
  /** The value. */
  readonly value: unknown
}

/** The strings `typeof` can yield. */
const VALID_TYPES = createSet<unknown>(['symbol', 'undefined', 'object', 'boolean', 'number', 'string', 'function', 'bigint'])

/** The operators that compare for equality. */
const OPERATORS = createSet<string>(['==', '===', '!=', '!=='])

export default defineRule<ValidTypeofOptions | undefined, Node>({
  id: 'valid-typeof',
  language: 'code',
  fixable: false,
  create(context) {
    const report = (node: Node): void => {
      context.report({ start: node.start, end: node.end, message: 'Invalid typeof comparison value.' })
    }
    return {
      UnaryExpression(node) {
        if (node.operator !== 'typeof') return
        const parent = node.parent as Node
        if (parent.kind !== 'BinaryExpression' || !OPERATORS.has(parent.operator as string)) return
        const sibling = (parent.left === node ? parent.right : parent.left) as Node
        const literal = literalValue(sibling)
        if (literal !== null) {
          if (!VALID_TYPES.has(literal.value)) report(sibling)
          return
        }
        if (sibling.kind === 'Identifier' && sibling.name === 'undefined' && isGlobalReference(scopeAnalysisOf(context), sibling))
          report(sibling)
      },
    }
  },
})

/**
 * The value a literal, or a template without substitutions, names.
 *
 * @param node - The expression compared with the `typeof`
 * @returns The value, or null when the expression is not a literal
 */
function literalValue(node: Node): LiteralValue | null {
  if (node.kind === 'Literal') return { value: node.value }
  if (node.kind !== 'TemplateLiteral' || (node.expressions as readonly Node[]).length > 0) return null
  const [quasi] = node.quasis as readonly Node[]
  return { value: ((quasi as Node).value as TemplateValue).cooked }
}
