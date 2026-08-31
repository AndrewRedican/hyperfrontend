import type { TSESTree } from '@typescript-eslint/utils'
import { ESLintUtils, AST_NODE_TYPES } from '@typescript-eslint/utils'

/**
 * Rule identifier for the no-mixed-type-export rule.
 */
export const RULE_NAME = 'no-mixed-type-export'

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)

/**
 * Message identifiers for the no-mixed-type-export rule.
 */
type MessageIds = 'noMixedTypeExport'

/**
 * Checks if a specifier is a type-only export.
 *
 * @param specifier - The export specifier to check.
 * @returns True if the specifier is type-only.
 */
function isTypeSpecifier(specifier: TSESTree.ExportSpecifier): boolean {
  return specifier.exportKind === 'type'
}

export default createRule<[], MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prohibit mixing type exports and value exports in a single export statement',
    },
    fixable: 'code',
    schema: [],
    messages: {
      noMixedTypeExport:
        "Mixed type and value exports are not allowed. Split into separate statements:\n  export type { TypeA, TypeB } from '...'\n  export { valueA, valueB } from '...'",
    },
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.sourceCode

    return {
      ExportNamedDeclaration(node) {
        if (node.exportKind === 'type') {
          return
        }

        if (node.declaration) {
          return
        }

        const specifiers = node.specifiers.filter((s) => s.type === AST_NODE_TYPES.ExportSpecifier) as TSESTree.ExportSpecifier[]

        if (specifiers.length === 0) {
          return
        }

        const typeSpecifiers = specifiers.filter(isTypeSpecifier)
        // why: filter callback always executed when specifiers exist
        const valueSpecifiers = specifiers.filter((s) => !isTypeSpecifier(s))

        if (typeSpecifiers.length === 0 || valueSpecifiers.length === 0) {
          return
        }

        context.report({
          node,
          messageId: 'noMixedTypeExport',
          fix(fixer) {
            const source = node.source ? ` from ${node.source.raw ?? `'${node.source.value}'`}` : ''

            const typeNames = typeSpecifiers.map((s) => {
              // why: always Identifier for standard exports
              if (s.local.type === AST_NODE_TYPES.Identifier) {
                const local = s.local.name
                const exported = s.exported.type === AST_NODE_TYPES.Identifier ? s.exported.name : sourceCode.getText(s.exported)
                // why: both branches tested but coverage varies
                return local === exported ? local : `${local} as ${exported}`
              }
              // why: fallback for non-Identifier exports
              return sourceCode.getText(s)
            })

            const valueNames = valueSpecifiers.map((s) => {
              // why: always Identifier for standard exports
              if (s.local.type === AST_NODE_TYPES.Identifier) {
                const local = s.local.name
                const exported = s.exported.type === AST_NODE_TYPES.Identifier ? s.exported.name : sourceCode.getText(s.exported)
                // why: both branches tested but coverage varies
                return local === exported ? local : `${local} as ${exported}`
              }
              // why: fallback for non-Identifier exports
              return sourceCode.getText(s)
            })

            const typeExport = `export type { ${typeNames.join(', ')} }${source}`
            const valueExport = `export { ${valueNames.join(', ')} }${source}`

            return fixer.replaceText(node, `${typeExport}\n${valueExport}`)
          },
        })
      },
    }
  },
})
