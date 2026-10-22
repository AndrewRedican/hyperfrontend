/**
 * An import names either types or values: one statement mixing `type` specifiers with value
 * specifiers is split into an `import type` and a plain import of the same source.
 *
 * @module rules/workspace/no-mixed-type-import
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'

/** What is reported. */
const MESSAGE =
  "Mixed type and value imports are not allowed. Split into separate statements:\n  import type { TypeA, TypeB } from '...'\n  import { valueA, valueB } from '...'"

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
 * A named specifier without its `type` keyword.
 *
 * @param specifier - The import specifier
 * @returns `imported` or `imported as local`
 */
function specifierText(specifier: Node): string {
  const imported = specifier.imported as Node
  const local = specifier.local as Node
  const same = imported.kind === 'Identifier' && imported.name === local.name
  return same ? nameOf(imported) : `${nameOf(imported)} as ${nameOf(local)}`
}

export default defineRule<undefined, Node>({
  id: 'workspace/no-mixed-type-import',
  language: 'code',
  fixable: true,
  create: (context) => ({
    ImportDeclaration(node) {
      if (node.importKind === 'type') return
      const specifiers = node.specifiers as readonly Node[]
      const named = specifiers.filter((specifier) => specifier.kind === 'ImportSpecifier')
      const types = named.filter((specifier) => specifier.importKind === 'type')
      const values = named.filter((specifier) => specifier.importKind !== 'type')
      if (types.length === 0 || values.length === 0) return
      const source = (node.source as Node).raw as string
      const defaults = specifiers
        .filter((specifier) => specifier.kind === 'ImportDefaultSpecifier')
        .map((specifier) => nameOf(specifier.local as Node))
      const valueClause = [...defaults, `{ ${values.map(specifierText).join(', ')} }`].join(', ')
      context.report({
        start: node.start,
        end: node.end,
        message: MESSAGE,
        fix: {
          start: node.start,
          end: node.end,
          text: `import type { ${types.map(specifierText).join(', ')} } from ${source}\nimport ${valueClause} from ${source}`,
        },
      })
    },
  }),
})
