/**
 * Two members of one enum with the same literal value are almost always a copy that was not
 * edited. A value is known when it is a string, a number, a template without substitutions, or
 * one of those under unary plus or minus; `-0` and `0` are distinct, and a value that is not a
 * number after the unary operator is not compared.
 *
 * @module rules/typescript/no-duplicate-enum-values
 */

import type { Node, TemplateValue } from '../../code/model'
import { isNaN } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule'

export default defineRule<undefined, Node>({
  id: 'typescript/no-duplicate-enum-values',
  language: 'code',
  fixable: false,
  create(context) {
    return {
      TSEnumDeclaration(node) {
        const seen = createSet<string>()
        for (const member of (node.body as Node).members as readonly Node[]) {
          const init = member.init as Node | null
          if (init === null) continue
          const value = knownValue(init)
          if (value === null) continue
          const key = keyOf(value)
          if (seen.has(key)) {
            context.report({ start: member.start, end: member.end, message: `Duplicate enum member value ${value}.` })
          } else {
            seen.add(key)
          }
        }
      },
    }
  },
})

/**
 * The value an initializer is statically known to have.
 *
 * @param init - The initializer expression
 * @returns The string or number, or null when it is not a literal of either
 */
function knownValue(init: Node): string | number | null {
  if (init.kind === 'Literal') {
    const value = init.value
    return typeof value === 'string' || typeof value === 'number' ? value : null
  }
  if (init.kind === 'TemplateLiteral') {
    const quasis = init.quasis as readonly Node[]
    return quasis.length === 1 ? ((quasis[0] as Node).value as TemplateValue).cooked : null
  }
  if (init.kind === 'UnaryExpression' && (init.operator === '-' || init.operator === '+')) {
    const inner = knownValue(init.argument as Node)
    if (inner === null) return null
    const number = init.operator === '-' ? -inner : +inner
    return isNaN(number) ? null : number
  }
  return null
}

/**
 * A key under which two equal values collide and two unequal ones do not: strings and numbers
 * are told apart, and so are `-0` and `0`.
 *
 * @param value - A known value
 * @returns Its key
 */
function keyOf(value: string | number): string {
  if (typeof value === 'string') return `s${value}`
  return `n${value === 0 && 1 / value < 0 ? '-0' : value}`
}
