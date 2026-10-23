/**
 * An export list names either types or values: one statement mixing `type` specifiers with
 * value specifiers is split into an `export type` and a plain export, of the same source when
 * it re-exports.
 *
 * @module rules/conventions/no-mixed-type-export
 */

import type { Node } from '../../code/model'
import { defineRule } from '../../engine/rule'

/** What is reported. */
const MESSAGE =
  "Mixed type and value exports are not allowed. Split into separate statements:\n  export type { TypeA, TypeB } from '...'\n  export { valueA, valueB } from '...'"

/**
 * A module name as written: an identifier's name or a string literal's raw text.
 *
 * @param node - The identifier or literal
 * @returns Its text
 */
function nameOf(node: Node): string {
  return node.kind === 'Identifier' ? (node.name as string) : (node.raw as string)
}

/**
 * An export specifier without its `type` keyword.
 *
 * @param specifier - The export specifier
 * @returns `local` or `local as exported`
 */
function specifierText(specifier: Node): string {
  const local = specifier.local as Node
  const exported = specifier.exported as Node
  const same = local.kind === 'Identifier' && exported.kind === 'Identifier' && local.name === exported.name
  return same ? nameOf(local) : `${nameOf(local)} as ${nameOf(exported)}`
}

export default defineRule<undefined, Node>({
  id: 'no-mixed-type-export',
  language: 'code',
  fixable: true,
  create: (context) => ({
    ExportNamedDeclaration(node) {
      if (node.exportKind === 'type' || node.declaration !== null) return
      const specifiers = node.specifiers as readonly Node[]
      const types = specifiers.filter((specifier) => specifier.exportKind === 'type')
      const values = specifiers.filter((specifier) => specifier.exportKind !== 'type')
      if (types.length === 0 || values.length === 0) return
      const source = node.source as Node | null
      const from = source === null ? '' : ` from ${source.raw as string}`
      context.report({
        start: node.start,
        end: node.end,
        message: MESSAGE,
        fix: {
          start: node.start,
          end: node.end,
          text: `export type { ${types.map(specifierText).join(', ')} }${from}\nexport { ${values.map(specifierText).join(', ')} }${from}`,
        },
      })
    },
  }),
})
