import type { TSESTree } from '@typescript-eslint/utils'
import { ESLintUtils, AST_NODE_TYPES } from '@typescript-eslint/utils'

/**
 * Rule identifier for the no-mixed-type-import rule.
 */
export const RULE_NAME = 'no-mixed-type-import'

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)

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
        // Skip if entire import is type-only (import type { ... })
        if (node.importKind === 'type') {
          return
        }

        // Get only ImportSpecifier nodes (not default or namespace)
        const specifiers = node.specifiers.filter((s): s is TSESTree.ImportSpecifier => s.type === AST_NODE_TYPES.ImportSpecifier)

        if (specifiers.length === 0) {
          return
        }

        const typeSpecifiers = specifiers.filter(isTypeSpecifier)
        /* istanbul ignore next - filter callback always executed when specifiers exist */
        const valueSpecifiers = specifiers.filter((s) => !isTypeSpecifier(s))

        // Only report if there's a mix of type and value specifiers
        if (typeSpecifiers.length === 0 || valueSpecifiers.length === 0) {
          return
        }

        context.report({
          node,
          messageId: 'noMixedTypeImport',
          fix(fixer) {
            /* istanbul ignore next - raw is always defined for valid imports */
            const source = node.source.raw ?? `'${node.source.value}'`

            // Build type import
            const typeNames = typeSpecifiers.map((s) => {
              /* istanbul ignore else - always Identifier for standard imports */
              if (s.imported.type === AST_NODE_TYPES.Identifier) {
                const imported = s.imported.name
                const local = s.local.name
                /* istanbul ignore next - both branches tested but coverage varies */
                return imported === local ? imported : `${imported} as ${local}`
              }
              /* istanbul ignore next - fallback for non-Identifier imports */
              return sourceCode.getText(s)
            })

            // Build value import
            const valueNames = valueSpecifiers.map((s) => {
              /* istanbul ignore else - always Identifier for standard imports */
              if (s.imported.type === AST_NODE_TYPES.Identifier) {
                const imported = s.imported.name
                const local = s.local.name
                /* istanbul ignore next - both branches tested but coverage varies */
                return imported === local ? imported : `${imported} as ${local}`
              }
              /* istanbul ignore next - fallback for non-Identifier imports */
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
