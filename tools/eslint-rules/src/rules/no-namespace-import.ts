import { ESLintUtils, AST_NODE_TYPES } from '@typescript-eslint/utils'

/**
 * Rule identifier for the no-namespace-import rule.
 */
export const RULE_NAME = 'no-namespace-import'

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)

/**
 * Message identifiers for the no-namespace-import rule.
 */
type MessageIds = 'noNamespaceImport'

/**
 * Checks if the import source is a JSON file.
 *
 * @param source - The import source string.
 * @returns True if the source ends with .json.
 */
function isJsonImport(source: string): boolean {
  return source.endsWith('.json')
}

export default createRule<[], MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prohibit namespace imports (`import * as`)',
    },
    schema: [],
    messages: {
      noNamespaceImport:
        "Namespace import 'import * as {{ name }}' is not allowed. Use named imports 'import { ... }' to enable tree-shaking and make dependencies explicit.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.importKind === 'type') {
          return
        }

        const source = node.source.value

        if (typeof source === 'string' && isJsonImport(source)) {
          return
        }

        for (const specifier of node.specifiers) {
          if (specifier.type === AST_NODE_TYPES.ImportNamespaceSpecifier) {
            context.report({
              node: specifier,
              messageId: 'noNamespaceImport',
              data: {
                name: specifier.local.name,
              },
            })
          }
        }
      },
    }
  },
})
