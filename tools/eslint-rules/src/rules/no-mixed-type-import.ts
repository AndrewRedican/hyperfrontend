import type { TSESTree } from '@typescript-eslint/utils'
import { ESLintUtils, AST_NODE_TYPES } from '@typescript-eslint/utils'

/**
 * Rule identifier for the no-mixed-type-import rule.
 */
export const RULE_NAME = 'no-mixed-type-import'

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)

/**
 * Message identifiers for the no-mixed-type-import rule.
 */
type MessageIds = 'noMixedTypeImport'

/**
 * Checks if a specifier is a type-only import.
 *
 * @param specifier - The import specifier to check.
 * @returns True if the specifier is type-only.
 */
function isTypeSpecifier(specifier: TSESTree.ImportSpecifier): boolean {
  return specifier.importKind === 'type'
}

export default createRule<[], MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prohibit mixing type imports and value imports in a single import statement',
    },
    fixable: 'code',
    schema: [],
    messages: {
      noMixedTypeImport:
        "Mixed type and value imports are not allowed. Split into separate statements:\n  import type { TypeA, TypeB } from '...'\n  import { valueA, valueB } from '...'",
    },
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.sourceCode

    return {
      ImportDeclaration(node) {
        if (node.importKind === 'type') {
          return
        }

        const specifiers = node.specifiers.filter((s): s is TSESTree.ImportSpecifier => s.type === AST_NODE_TYPES.ImportSpecifier)

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
          messageId: 'noMixedTypeImport',
          fix(fixer) {
            // why: raw is always defined for valid imports
            const source = node.source.raw ?? `'${node.source.value}'`

            const typeNames = typeSpecifiers.map((s) => {
              // why: always Identifier for standard imports
              if (s.imported.type === AST_NODE_TYPES.Identifier) {
                const imported = s.imported.name
                const local = s.local.name
                // why: both branches tested but coverage varies
                return imported === local ? imported : `${imported} as ${local}`
              }
              // why: fallback for non-Identifier imports
              return sourceCode.getText(s)
            })

            const valueNames = valueSpecifiers.map((s) => {
              // why: always Identifier for standard imports
              if (s.imported.type === AST_NODE_TYPES.Identifier) {
                const imported = s.imported.name
                const local = s.local.name
                // why: both branches tested but coverage varies
                return imported === local ? imported : `${imported} as ${local}`
              }
              // why: fallback for non-Identifier imports
              return sourceCode.getText(s)
            })

            const typeImport = `import type { ${typeNames.join(', ')} } from ${source}`
            const valueImport = `import { ${valueNames.join(', ')} } from ${source}`

            return fixer.replaceText(node, `${typeImport}\n${valueImport}`)
          },
        })
      },
    }
  },
})
